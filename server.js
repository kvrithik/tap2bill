hiconst express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bodyParser = require('body-parser');
const bcrypt = require('bcryptjs');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Enhanced Static Asset Caching (Improves Lighthouse & GTmetrix scores)
app.use(express.static(__dirname, {
    maxAge: '1d', // Cache static assets for 1 day by default
    etag: true,
    setHeaders: (res, filePath) => {
        // Cache images aggressively for 7 days
        if (filePath.match(/\.(png|jpg|jpeg|gif|webp|svg|ico)$/i)) {
            res.setHeader('Cache-Control', 'public, max-age=604800, immutable');
        } else if (filePath.match(/\.(css|js)$/i)) {
            res.setHeader('Cache-Control', 'public, max-age=86400');
        }
    }
}));

// Root route
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/home.html');
});

// MongoDB Connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/tap2bill';
mongoose.connect(MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => {
    console.log('Connected to MongoDB');
}).catch(err => {
    console.error('Error connecting to MongoDB:', err);
});

// User Schema
const userSchema = new mongoose.Schema({
    hotelName: { type: String, required: true },
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true }, // Added Email
    phone: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);



// Signup Route
app.post('/api/signup', async (req, res) => {
    try {
        const { hotelName, name, email, phone, password } = req.body;

        // Check if user already exists (by phone or email)
        const existingUser = await User.findOne({ $or: [{ phone }, { email }] });
        if (existingUser) {
            return res.status(400).json({ success: false, message: 'User already exists with this phone number or email' });
        }

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const newUser = new User({
            hotelName,
            name,
            email,
            phone,
            password: hashedPassword
        });

        await newUser.save();

        res.status(201).json({ success: true, message: 'User created successfully', user: { name: newUser.name, email: newUser.email } });
    } catch (error) {
        console.error('Signup error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Login Route
app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        // Find user by email
        const user = await User.findOne({ email });

        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        // Validate password
        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch) {
            return res.status(401).json({ success: false, message: 'Invalid password' });
        }

        res.json({
            success: true,
            message: 'Login successful',
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                hotelName: user.hotelName,
                phone: user.phone
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Order Schema
const orderSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    items: [{
        name: String,
        price: Number,
        quantity: Number
    }],
    totalAmount: Number,
    date: { type: Date, default: Date.now }
});

const Order = mongoose.model('Order', orderSchema);


// Create Order Route
app.post('/api/orders', async (req, res) => {
    try {
        const { userId, items, totalAmount } = req.body;

        if (!userId || !items || items.length === 0) {
            return res.status(400).json({ success: false, message: 'Invalid order data' });
        }

        const newOrder = new Order({ userId, items, totalAmount });
        await newOrder.save();

        // Invalidate trending cache so fresh order data is factored in
        trendingCache = null;

        res.status(201).json({ success: true, message: 'Order created successfully', orderId: newOrder._id });
    } catch (error) {
        console.error('Order creation error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Get User Orders Route
app.get('/api/orders/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const orders = await Order.find({ userId }).sort({ date: -1 });
        res.json({ success: true, orders });
    } catch (error) {
        console.error('Fetch orders error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});


//  TRENDING FOOD DETECTION — ML (Time-Decay Exponential Smoothing)
// Algorithm: Score = Σ( quantity × e^(−λ × hours_ago) )
// λ = 0.005 → recent orders score higher; older orders decay gradually
let trendingCache = null;
let trendingCacheExpiry = 0;

app.get('/api/trending', async (req, res) => {
    try {
        const now = Date.now();

        // Return in-memory cached results if still valid (10-minute cache)
        if (trendingCache && now < trendingCacheExpiry) {
            return res.json({
                ...trendingCache,
                cached: true,
                cacheExpiresInSeconds: Math.round((trendingCacheExpiry - now) / 1000)
            });
        }

        const LAMBDA = 0.005;
        const DAYS_BACK = 30;
        const TOP_N = 5;
        const since = new Date();
        since.setDate(since.getDate() - DAYS_BACK);

        // Fetch all recent orders from MongoDB
        const recentOrders = await Order.find({ date: { $gte: since } }).lean();

        if (recentOrders.length === 0) {
            return res.json({
                success: true,
                trending: [],
                message: 'Not enough order data yet. Place some orders!',
                lastUpdated: new Date()
            });
        }

        const scoreMap = {}; // { itemName: { score, totalOrders } 

        recentOrders.forEach(order => {
            const orderAgeHours = (now - new Date(order.date).getTime()) / (1000 * 60 * 60);
            const decayFactor = Math.exp(-LAMBDA * orderAgeHours); // e^(-λ × age)

            order.items.forEach(item => {
                const name = item.name;
                const qty = item.quantity || 1;

                if (!scoreMap[name]) {
                    scoreMap[name] = { score: 0, totalOrders: 0 };
                }
                //update  the score 
                scoreMap[name].score += qty * decayFactor;
                scoreMap[name].totalOrders += qty;
            });
        });

        // Sort by score descending and take top N
        const trending = Object.entries(scoreMap)
            .map(([name, data]) => ({
                name,
                score: parseFloat(data.score.toFixed(4)),
                totalOrders: data.totalOrders,
                trendStrength: Math.min(100, Math.round(data.score * 10)) // 0–100 popularity %
            }))
            .sort((a, b) => b.score - a.score)
            .slice(0, TOP_N);

        const responsePayload = {
            success: true,
            trending,
            totalItemsAnalyzed: Object.keys(scoreMap).length,
            totalOrdersAnalyzed: recentOrders.length,
            lastUpdated: new Date(),
            nextRefreshIn: '10 minutes'
        };

        // Cache for 10 minutes (600,000 ms)
        trendingCache = responsePayload;
        trendingCacheExpiry = now + 10 * 60 * 1000;

        res.json(responsePayload);

    } catch (error) {
        console.error('Trending detection error:', error);
        res.status(500).json({ success: false, message: 'Server error while computing trending foods' });
    }
});


// KNN Collaborative Filtering Recommendation System
app.get('/api/recommendations/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const TOP_N = 5;
        const NEIGHBORS = 3;

        // Fetch all recent orders from MongoDB
        const allOrders = await Order.find({}).lean();

        if (allOrders.length === 0) {
            return res.json({ success: true, recommendations: [], message: 'No order data available yet.' });
        }

        const itemPrices = {};

        // 1. Build User-Item Interaction Map
        // Format: { userId1: { itemName1: count, itemName2: count }, userId2: ... }
        const userItemMap = {};
        allOrders.forEach(order => {
            const id = order.userId.toString();
            if (!userItemMap[id]) userItemMap[id] = {};

            order.items.forEach(item => {
                if (!item.name) return; // safeguard
                if (!userItemMap[id][item.name]) userItemMap[id][item.name] = 0;
                userItemMap[id][item.name] += (item.quantity || 1);
                if (item.price) itemPrices[item.name] = item.price;
            });
        });

        const targetUserHistory = userItemMap[userId];

        // 2. Cold Start Fallback
        if (!targetUserHistory || Object.keys(targetUserHistory).length === 0) {
            // New user, practically zero orders. Fallback to Popular items.
            const itemCounts = {};
            allOrders.forEach(order => {
                order.items.forEach(item => {
                    if (item.name) {
                        itemCounts[item.name] = (itemCounts[item.name] || 0) + (item.quantity || 1);
                    }
                });
            });
            const popularItems = Object.entries(itemCounts)
                .sort((a, b) => b[1] - a[1])
                .slice(0, TOP_N)
                .map(item => ({ name: item[0], price: itemPrices[item[0]] || 50, reason: 'Popular Choice' }));

            return res.json({
                success: true,
                recommendations: popularItems,
                message: 'Cold Start: Displaying Popular Items'
            });
        }

        // 3. Calculate Cosine Similarity for KNN
        // dotProduct(A, B) / (magnitude(A) * magnitude(B))
        function getSimilarity(userA, userB) {
            let dotProduct = 0;
            let magA = 0;
            let magB = 0;

            const allFoods = new Set([...Object.keys(userA), ...Object.keys(userB)]);
            allFoods.forEach(food => {
                const valA = userA[food] || 0;
                const valB = userB[food] || 0;
                dotProduct += valA * valB;
                magA += valA * valA;
                magB += valB * valB;
            });

            if (magA === 0 || magB === 0) return 0;
            return dotProduct / (Math.sqrt(magA) * Math.sqrt(magB));
        }

        const similarities = [];
        for (let otherUserId in userItemMap) {
            if (otherUserId !== userId) {
                const score = getSimilarity(targetUserHistory, userItemMap[otherUserId]);
                if (score > 0) {
                    similarities.push({ userId: otherUserId, score });
                }
            }
        }

        // Sort by most similar users
        similarities.sort((a, b) => b.score - a.score);
        const topNeighbors = similarities.slice(0, NEIGHBORS);

        // 4. Generate Recommendations based on what neighbors bought that target hasn't
        const recommendationWeights = {};

        topNeighbors.forEach(neighbor => {
            const neighborHistory = userItemMap[neighbor.userId];
            for (let food in neighborHistory) {
                // If neighbor ate it, and target user HAS NOT eaten it
                if (neighborHistory[food] > 0 && !targetUserHistory[food]) {
                    if (!recommendationWeights[food]) recommendationWeights[food] = 0;
                    recommendationWeights[food] += (neighborHistory[food] * neighbor.score);
                }
            }
        });

        let recommendedItems = Object.entries(recommendationWeights)
            .sort((a, b) => b[1] - a[1])
            .slice(0, TOP_N)
            .map(item => ({ name: item[0], price: itemPrices[item[0]] || 50, reason: 'Recommended for you' }));

        // 5. If no recommendations found (e.g. neighbors ate exact same things), fallback
        if (recommendedItems.length === 0) {
            const itemCounts = {};
            allOrders.forEach(order => {
                order.items.forEach(item => {
                    if (item.name) {
                        itemCounts[item.name] = (itemCounts[item.name] || 0) + (item.quantity || 1);
                    }
                });
            });
            const popularItems = Object.entries(itemCounts)
                .sort((a, b) => b[1] - a[1])
                .slice(0, TOP_N)
                .map(item => ({ name: item[0], price: itemPrices[item[0]] || 50, reason: 'Popular Choice' }));

            return res.json({
                success: true,
                recommendations: popularItems,
                message: 'Fallback to popular items as no unique recommendations found'
            });
        }

        res.json({
            success: true,
            recommendations: recommendedItems,
            message: 'Recommendations generated successfully via KNN'
        });

    } catch (error) {
        console.error('Recommendation Engine error:', error);
        res.status(500).json({ success: false, message: 'Server error computing recommendations' });
    }
});

app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date(),
        dbState: mongoose.connection.readyState
    });
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    // Application specific logging, throwing an error, or other logic here
});

// Start Server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

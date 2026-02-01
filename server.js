const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bodyParser = require('body-parser');
const bcrypt = require('bcryptjs'); // Import bcryptjs

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(__dirname)); // Serve static files from current directory

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

// Routes

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

// ... (User Routes) ...

// Create Order Route
app.post('/api/orders', async (req, res) => {
    try {
        const { userId, items, totalAmount } = req.body;

        if (!userId || !items || items.length === 0) {
            return res.status(400).json({ success: false, message: 'Invalid order data' });
        }

        const newOrder = new Order({ userId, items, totalAmount });
        await newOrder.save();

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

// Start Server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});

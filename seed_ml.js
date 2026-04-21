const mongoose = require('mongoose');

// This script injects strategic ML testing data into the database
// so the Recommendation engine shifts dynamically.

mongoose.connect('mongodb://localhost:27017/tap2bill').then(async () => {
    try {
        const db = mongoose.connection.db;
        
        // 1. Give every existing user an order of "Kal Dosa" so they have a history to match against
        const allUsers = await db.collection('users').find({}).toArray();
        for (let u of allUsers) {
             await db.collection('orders').insertOne({
                 userId: u._id,
                 items: [{ name: 'Kal Dosa', price: 50, quantity: 1 }],
                 totalAmount: 50,
                 date: new Date()
             });
        }
        
        // 2. Create 3 brand new "ML Twin" users 
        for(let i=0; i<3; i++) {
            const res = await db.collection('users').insertOne({
                name: 'ML Twin User ' + i,
                email: `twin${i}@test.com`,
                phone: `99988812${i}`,
                password: 'password123'
            });
            
            // The twins order "Kal Dosa" AND a secret "Special AI Milkshake"
            await db.collection('orders').insertOne({
                 userId: res.insertedId,
                 items: [
                     { name: 'Kal Dosa', price: 50, quantity: 2 },
                     { name: 'Special AI Milkshake', price: 120, quantity: 1 },
                     { name: 'Veg Noodles', price: 90, quantity: 1 }
                 ],
                 totalAmount: 260,
                 date: new Date()
            });
        }
        
        console.log("✅ Successfully injected ML training data into MongoDB!");
        process.exit();
    } catch(err) {
        console.error("Error:", err);
        process.exit(1);
    }
});

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(cors());
app.use(express.static('public'));

// MongoDB Connection
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/chat-app';
mongoose.connect(MONGO_URI)
    .then(() => console.log('Connected to MongoDB'))
    .catch(err => console.error('Could not connect to MongoDB', err));

// User Schema
const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, default: 'Member', enum: ['Member', 'Owner', 'Developer'] },
    isOnline: { type: Boolean, default: false },
    lastActive: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);

/**
 * Background Task: Cleanup Inactive Users
 * Sets users to offline if they haven't sent a heartbeat in 30 seconds
 */
setInterval(async () => {
    const threshold = new Date(Date.now() - 30000);
    await User.updateMany(
        { lastActive: { $lt: threshold }, isOnline: true },
        { isOnline: false }
    );
}, 15000);

// --- Auth Routes ---

// Register
app.post('/api/auth/register', async (req, res) => {
    try {
        const { username, email, password } = req.body;
        const existing = await User.findOne({ $or: [{ username }, { email }] });
        if (existing) {
            return res.status(400).json({ success: false, message: 'Username or Email already taken' });
        }

        const newUser = new User({ 
            username, 
            email, 
            password, 
            isOnline: true,
            lastActive: Date.now()
        });
        await newUser.save();

        res.json({ 
            success: true, 
            user: { username: newUser.username, role: newUser.role, email: newUser.email, password: newUser.password } 
        });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error during registration' });
    }
});

// Login / Heartbeat
// This handles the heartbeat by updating lastActive and isOnline
app.post('/api/auth/login', async (req, res) => {
    try {
        const { identifier, password } = req.body;
        
        const user = await User.findOne({ 
            $or: [{ username: identifier }, { email: identifier }],
            password: password 
        });

        if (!user) {
            return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }

        user.isOnline = true;
        user.lastActive = Date.now();
        await user.save();

        res.json({ 
            success: true, 
            user: { username: user.username, role: user.role, email: user.email, password: user.password } 
        });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// --- User Management Routes ---

// Get all users (sorted: online first, then by username)
app.get('/api/users', async (req, res) => {
    try {
        const users = await User.find({}, 'username role isOnline').sort({ isOnline: -1, username: 1 });
        res.json(users);
    } catch (err) {
        res.status(500).json({ success: false, message: 'Error fetching users' });
    }
});

// Update Rank (Admin Only)
app.put('/api/admin/rank', async (req, res) => {
    try {
        const { adminUsername, targetUsername, newRole } = req.body;

        const admin = await User.findOne({ username: adminUsername });
        if (!admin || (admin.role !== 'Developer' && admin.role !== 'Owner')) {
            return res.status(403).json({ success: false, message: 'Insufficient permissions' });
        }

        const target = await User.findOneAndUpdate(
            { username: targetUsername },
            { role: newRole },
            { new: true }
        );

        if (!target) return res.status(404).json({ success: false, message: 'User not found' });

        res.json({ success: true, message: `Rank updated for ${targetUsername}` });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error updating rank' });
    }
});

// Delete User (Admin Only)
app.delete('/api/admin/users/:username', async (req, res) => {
    try {
        const { adminUsername } = req.query;
        const targetUsername = req.params.username;

        const admin = await User.findOne({ username: adminUsername });
        if (!admin || (admin.role !== 'Developer' && admin.role !== 'Owner')) {
            return res.status(403).json({ success: false, message: 'Insufficient permissions' });
        }

        await User.findOneAndDelete({ username: targetUsername });
        res.json({ success: true, message: 'User deleted' });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error deleting user' });
    }
});

// Global Fallback
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});

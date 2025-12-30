const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    maxHttpBufferSize: 1e7 // Allow for larger profile data
});

// Replace with your actual Mongo URI
mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/connect_app')
    .then(() => console.log('✅ MongoDB Connected'))
    .catch(err => console.error('❌ DB Connection Error:', err));

const UserSchema = new mongoose.Schema({
    email: { type: String, unique: true, required: true, lowercase: true },
    password: { type: String, required: true },
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    profilePic: { type: String, default: "" },
    bio: { type: String, default: "New to Connect!" }
});

const MessageSchema = new mongoose.Schema({
    user: String,
    text: String,
    pfp: String,
    email: String,
    timestamp: { type: Date, default: Date.now }
});

const User = mongoose.model('User', UserSchema);
const Message = mongoose.model('Message', MessageSchema);

app.use(express.static('public'));
app.use(express.json());

// --- AUTH SYSTEM ---
app.post('/auth', async (req, res) => {
    const { email, password, firstName, lastName, type } = req.body;
    try {
        const cleanEmail = email.toLowerCase().trim();

        if (type === 'signup') {
            if (!email || !password || !firstName || !lastName) {
                return res.json({ success: false, message: "All fields are required." });
            }
            const exists = await User.findOne({ email: cleanEmail });
            if (exists) return res.json({ success: false, message: "Email already exists." });

            const pfp = `https://api.dicebear.com/7.x/avataaars/svg?seed=${Math.random()}`;
            const user = await User.create({ email: cleanEmail, password, firstName, lastName, profilePic: pfp });
            return res.json({ success: true, user });
        }

        // Login
        const user = await User.findOne({ email: cleanEmail, password });
        if (user) return res.json({ success: true, user });
        res.json({ success: false, message: "Invalid email or password." });

    } catch (e) {
        console.error("Auth Error:", e);
        res.json({ success: false, message: "Server Error: " + e.message });
    }
});

// --- SOCKET ENGINE ---
let onlineUsers = {};
io.on('connection', async (socket) => {
    // Send message history to new user
    const history = await Message.find().sort({ _id: -1 }).limit(50);
    socket.emit('load-history', history.reverse());

    socket.on('join-chat', (user) => {
        socket.user = user;
        onlineUsers[socket.id] = user;
        io.emit('update-users', Object.values(onlineUsers));
    });

    socket.on('chat-msg', async (text) => {
        if (!socket.user) return;
        const msg = await Message.create({
            user: `${socket.user.firstName} ${socket.user.lastName}`,
            text,
            pfp: socket.user.profilePic,
            email: socket.user.email
        });
        io.emit('chat-msg', msg);
    });

    socket.on('disconnect', () => {
        delete onlineUsers[socket.id];
        io.emit('update-users', Object.values(onlineUsers));
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`🚀 Server flying on port ${PORT}`));

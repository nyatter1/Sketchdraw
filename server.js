const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// MongoDB Connection
mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/connect_app')
    .then(() => console.log('✅ MongoDB Connected'))
    .catch(err => console.error('❌ DB Error:', err));

const UserSchema = new mongoose.Schema({
    email: { type: String, unique: true, required: true, lowercase: true },
    password: { type: String, required: true },
    firstName: String,
    lastName: String
});

const MessageSchema = new mongoose.Schema({
    user: String, text: String, email: String, timestamp: { type: Date, default: Date.now }
});

const User = mongoose.model('User', UserSchema);
const Message = mongoose.model('Message', MessageSchema);

app.use(express.static('public'));
app.use(express.json());

app.post('/auth', async (req, res) => {
    const { email, password, firstName, lastName, type } = req.body;
    try {
        const cleanEmail = email.toLowerCase().trim();
        if (type === 'signup') {
            const exists = await User.findOne({ email: cleanEmail });
            if (exists) return res.json({ success: false, message: "Email already exists." });
            const user = await User.create({ email: cleanEmail, password, firstName, lastName });
            return res.json({ success: true, user });
        }
        const user = await User.findOne({ email: cleanEmail, password });
        if (user) return res.json({ success: true, user });
        res.json({ success: false, message: "Invalid credentials." });
    } catch (e) { res.json({ success: false, message: "Server Error" }); }
});

let onlineUsers = {};
io.on('connection', async (socket) => {
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
            text, email: socket.user.email
        });
        io.emit('chat-msg', msg);
    });

    // GLOBAL CLEAR LOGIC
    socket.on('request-clear-all', async () => {
        await Message.deleteMany({}); // Delete from Database
        io.emit('chat-cleared-globally'); // Tell everyone to wipe their screen
    });

    socket.on('disconnect', () => {
        delete onlineUsers[socket.id];
        io.emit('update-users', Object.values(onlineUsers));
    });
});

server.listen(process.env.PORT || 3000, () => console.log('Server running...'));

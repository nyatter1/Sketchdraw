const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');

const app = express();
const server = http.createServer(app);
// Added heartbeat settings to keep connections alive through firewalls
const io = new Server(server, {
    pingTimeout: 60000,
    cors: { origin: "*" }
});

// Use a connection string with a long timeout for international users
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/connect_app';
mongoose.connect(MONGO_URI, { serverSelectionTimeoutMS: 10000 })
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
    } catch (e) {
        // Detailed error reporting for your friend
        console.error("Auth Fail:", e.message);
        res.json({ success: false, message: `Connection Error: ${e.message}` });
    }
});

let onlineUsers = {};
io.on('connection', async (socket) => {
    try {
        const history = await Message.find().sort({ _id: -1 }).limit(50);
        socket.emit('load-history', history.reverse());
    } catch (err) { console.log("History load error"); }

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

    socket.on('request-clear-all', async () => {
        await Message.deleteMany({});
        io.emit('chat-cleared-globally');
    });

    socket.on('disconnect', () => {
        delete onlineUsers[socket.id];
        io.emit('update-users', Object.values(onlineUsers));
    });
});

server.listen(process.env.PORT || 3000, '0.0.0.0');

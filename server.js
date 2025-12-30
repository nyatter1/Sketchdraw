const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const fs = require('fs');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const USERS_FILE = path.join(__dirname, 'users.json');

// Helper to load users safely
function loadUsers() {
    if (!fs.existsSync(USERS_FILE)) {
        fs.writeFileSync(USERS_FILE, JSON.stringify({}));
    }
    try {
        return JSON.parse(fs.readFileSync(USERS_FILE));
    } catch (e) {
        return {};
    }
}

app.use(express.static('public'));
app.use(express.json());

let onlineUsers = {}; // Tracks socketID -> Username

// Authentication Route
app.post('/auth', (req, res) => {
    const { username, password, dob, type } = req.body;
    const users = loadUsers();

    if (type === 'signup') {
        if (users[username]) {
            return res.json({ success: false, message: "Username taken!" });
        }
        // Save user with DOB
        users[username] = { password, dob };
        fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
        return res.json({ success: true, message: "Account created!" });
    } 
    
    if (type === 'login') {
        if (users[username] && users[username].password === password) {
            return res.json({ success: true });
        }
        return res.json({ success: false, message: "Invalid credentials" });
    }
});

// Real-time Chat Logic
io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('join-chat', (username) => {
        socket.username = username;
        onlineUsers[socket.id] = username;
        
        // Broadcast new user list to everyone
        io.emit('update-user-list', Object.values(onlineUsers));
        // Tell chat someone joined
        socket.broadcast.emit('chat-message', { 
            user: "System", 
            text: `${username} has joined the chat!`, 
            type: 'system' 
        });
    });

    socket.on('chat-message', (msg) => {
        if (!socket.username) return; // Block messages from non-logged users
        io.emit('chat-message', { user: socket.username, text: msg, type: 'user' });
    });

    socket.on('disconnect', () => {
        if (socket.username) {
            delete onlineUsers[socket.id];
            io.emit('update-user-list', Object.values(onlineUsers));
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));

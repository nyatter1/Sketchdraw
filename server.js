const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const app = express();
const server = http.createServer(app);
const io = new Server(server);
let activeUsers = {};
app.use(express.static('public'));
io.on('connection', (socket) => {
    socket.on('set-username', (username) => {
        activeUsers[socket.id] = username;
        io.emit('update-user-list', Object.values(activeUsers));
    });
    socket.on('disconnect', () => {
        delete activeUsers[socket.id];
        io.emit('update-user-list', Object.values(activeUsers));
    });
});
server.listen(3000, () => console.log('Server running on http://localhost:3000'));

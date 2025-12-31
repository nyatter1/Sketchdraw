const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const app = express();

// Handle large image uploads
app.use(express.json({ limit: '50mb' })); 
app.use(cors());
app.use(express.static('public'));

// --- CONNECT TO MONGODB ---
const MONGO_URI = 'mongodb+srv://hayden:123password123@cluster0.kzhhujn.mongodb.net/nyatter?retryWrites=true&w=majority&appName=Cluster0'; 

mongoose.connect(MONGO_URI)
    .then(() => console.log("✅ Nyatter Database Connected!"))
    .catch(err => console.error("❌ DB Connection Error:", err));

// --- DATA SCHEMA ---
const Post = mongoose.model('Post', new mongoose.Schema({
    user: String,
    text: String,
    img: String,
    likes: { type: Array, default: [] },
    replies: { type: Array, default: [] },
    pinned: { type: Boolean, default: false },
    timestamp: { type: Number, default: Date.now }
}));

// --- API ROUTES ---
app.get('/api/posts', async (req, res) => {
    try {
        const posts = await Post.find().sort({ pinned: -1, timestamp: -1 });
        res.json(posts);
    } catch (err) {
        res.status(500).json({ error: "Fetch failed" });
    }
});

app.post('/api/posts', async (req, res) => {
    try {
        const newPost = new Post(req.body);
        await newPost.save();
        res.status(201).json(newPost);
    } catch (err) {
        res.status(500).json({ error: "Post failed" });
    }
});

app.post('/api/posts/like', async (req, res) => {
    const { id, user } = req.body;
    const post = await Post.findById(id);
    if (post.likes.includes(user)) {
        post.likes = post.likes.filter(u => u !== user);
    } else {
        post.likes.push(user);
    }
    await post.save();
    res.json(post);
});

app.post('/api/posts/reply', async (req, res) => {
    const { id, user, text } = req.body;
    const post = await Post.findById(id);
    post.replies.push({ user, text });
    await post.save();
    res.json(post);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));

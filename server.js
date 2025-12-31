const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const app = express();

app.use(express.json({ limit: '50mb' })); // Increased limit for image uploads
app.use(cors());
app.use(express.static('public'));

// 1. DATABASE CONNECTION
// REPLACE THIS STRING with your real MongoDB connection string!
const MONGO_URI = "your_mongodb_connection_string_here"; 

mongoose.connect(MONGO_URI)
    .then(() => console.log("Connected to MongoDB Global"))
    .catch(err => console.log("DB Error:", err));

// 2. THE POST MODEL
const PostSchema = new mongoose.Schema({
    user: String,
    text: String,
    img: String,
    likes: { type: Array, default: [] },
    replies: { type: Array, default: [] },
    pinned: { type: Boolean, default: false },
    timestamp: { type: Number, default: Date.now }
});
const Post = mongoose.model('Post', PostSchema);

// 3. API ROUTES
app.get('/api/posts', async (req, res) => {
    const posts = await Post.find().sort({ pinned: -1, timestamp: -1 });
    res.json(posts);
});

app.post('/api/posts', async (req, res) => {
    const newPost = new Post(req.body);
    await newPost.save();
    res.json(newPost);
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

// Admin routes for HaydenDev
app.post('/api/posts/delete', async (req, res) => {
    if(req.body.admin === "HaydenDev") {
        await Post.findByIdAndDelete(req.body.id);
        res.json({ success: true });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Nyatter Server running on ${PORT}`));

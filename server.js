const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const app = express();

app.use(express.json({ limit: '50mb' })); 
app.use(cors());
app.use(express.static('public'));

// 1. DATABASE CONNECTION
// REPLACE 'YOUR_MONGODB_URL' with your real connection string from Atlas
mongoose.connect('YOUR_MONGODB_URL')
    .then(() => console.log("Database Connected!"))
    .catch(err => console.error("DB Error:", err));

// 2. DATA SCHEMA
const Post = mongoose.model('Post', new mongoose.Schema({
    user: String,
    text: String,
    img: String,
    likes: { type: Array, default: [] },
    replies: { type: Array, default: [] },
    pinned: { type: Boolean, default: false },
    timestamp: { type: Number, default: Date.now }
}));

// 3. ROUTES
app.get('/api/posts', async (req, res) => {
    const posts = await Post.find().sort({ pinned: -1, timestamp: -1 });
    res.json(posts);
});

app.post('/api/posts', async (req, res) => {
    const newPost = new Post(req.body);
    await newPost.save();
    res.status(201).json(newPost);
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
app.listen(PORT, () => console.log(`Nyatter Server running on ${PORT}`));

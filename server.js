const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// --- MIDDLEWARE ---
app.use(cors());
app.use(express.json());

// Tell the server to serve all frontend files from the 'public' folder
app.use(express.static(path.join(__dirname, 'public')));

// --- DATABASE CONNECTION ---
// For local testing, use 'mongodb://127.0.0.1:27017/vikvok_live'
// For Render/Production, you will replace this with your MongoDB Atlas Connection String
const mongoURI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/vikvok_live';

mongoose.connect(mongoURI)
    .then(() => console.log("✅ VikVok Database Connected"))
    .catch(err => console.error("❌ DB Connection Error:", err));

// --- DATA MODELS ---
const UserSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    followers: { type: Number, default: 0 },
    following: { type: Number, default: 0 },
    totalLikes: { type: Number, default: 0 },
    bio: { type: String, default: "Entering the flow state. ✨" }
});

const VideoSchema = new mongoose.Schema({
    username: String,
    videoUrl: String,
    caption: String,
    likes: { type: Number, default: 0 },
    comments: { type: Array, default: [] },
    createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', UserSchema);
const Video = mongoose.model('Video', VideoSchema);

// --- ROUTES ---

// 1. Root Route - Serves index.html from public folder
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 2. Sign Up - Checks for unique username/email
app.post('/api/signup', async (req, res) => {
    try {
        const { username, email, password } = req.body;
        const newUser = new User({ username, email, password });
        await newUser.save();
        res.status(201).json({ message: "Account Created", user: { username: newUser.username } });
    } catch (err) {
        if (err.code === 11000) {
            res.status(400).json({ error: "Username or Email already exists!" });
        } else {
            res.status(500).json({ error: "Server Error during registration" });
        }
    }
});

// 3. Login
app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;
    const user = await User.findOne({ email, password });
    if (user) {
        res.json({ username: user.username });
    } else {
        res.status(401).json({ error: "Invalid credentials" });
    }
});

// 4. Feed - Get all videos
app.get('/api/videos', async (req, res) => {
    try {
        const videos = await Video.find().sort({ createdAt: -1 });
        res.json(videos);
    } catch (err) {
        res.status(500).json({ error: "Could not fetch feed" });
    }
});

// 5. Upload Video - Starts with 0 likes/comments
app.post('/api/upload', async (req, res) => {
    const { username, videoUrl, caption } = req.body;
    const newVideo = new Video({ 
        username, 
        videoUrl, 
        caption,
        likes: 0,
        comments: []
    });
    await newVideo.save();
    res.status(201).json(newVideo);
});

// 6. Like Action
app.post('/api/videos/:id/like', async (req, res) => {
    try {
        const video = await Video.findByIdAndUpdate(req.params.id, { $inc: { likes: 1 } }, { new: true });
        res.json(video);
    } catch (err) {
        res.status(500).json({ error: "Could not like video" });
    }
});

// 7. Profile Data - Dynamic lookup by username
app.get('/api/profile/:username', async (req, res) => {
    const user = await User.findOne({ username: req.params.username });
    if (user) {
        const userVideos = await Video.find({ username: req.params.username });
        res.json({ user, videos: userVideos });
    } else {
        res.status(404).json({ error: "User profile not found" });
    }
});

// Start Server
app.listen(PORT, () => {
    console.log(`🚀 VikVok Live Server running at http://localhost:${PORT}`);
});

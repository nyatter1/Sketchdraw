const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '/')));

// --- DATABASE CONNECTION ---
// Replace the URL with your MongoDB Atlas connection string for a 100% live cloud DB
mongoose.connect('mongodb://127.0.0.1:27017/vikvok_live')
    .then(() => console.log("✅ VikVok Database Connected"))
    .catch(err => console.error("❌ DB Connection Error:", err));

// --- MODELS ---
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

// 1. Sign Up (Prevents duplicates via MongoDB unique indexes)
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
            res.status(500).json({ error: "Server Error" });
        }
    }
});

// 2. Login
app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;
    const user = await User.findOne({ email, password });
    if (user) {
        res.json({ username: user.username });
    } else {
        res.status(401).json({ error: "Invalid credentials" });
    }
});

// 3. Get All Videos (The Feed)
app.get('/api/videos', async (req, res) => {
    const videos = await Video.find().sort({ createdAt: -1 });
    res.json(videos);
});

// 4. Upload Video
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

// 5. Like a Video
app.post('/api/videos/:id/like', async (req, res) => {
    const video = await Video.findByIdAndUpdate(req.params.id, { $inc: { likes: 1 } }, { new: true });
    res.json(video);
});

// 6. Get Profile Data
app.get('/api/profile/:username', async (req, res) => {
    const user = await User.findOne({ username: req.params.username });
    if (user) {
        const userVideos = await Video.find({ username: req.params.username });
        res.json({ user, videos: userVideos });
    } else {
        res.status(404).json({ error: "User not found" });
    }
});

app.listen(PORT, () => {
    console.log(`🚀 VikVok Live Server running on http://localhost:${PORT}`);
});

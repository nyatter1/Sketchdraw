const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 10000; // Render uses port 10000 by default

// --- MIDDLEWARE ---
app.use(cors());
app.use(express.json());

// Serve all frontend files from the 'public' folder
app.use(express.static(path.join(__dirname, 'public')));

// --- DATABASE CONNECTION ---
// We use ONLY the environment variable to ensure it connects to Atlas
const mongoURI = process.env.MONGODB_URI;

console.log("--- System Check ---");
if (mongoURI) {
    console.log("✅ MONGODB_URI detected in environment.");
} else {
    console.log("❌ ERROR: MONGODB_URI is missing from Render Environment Variables.");
}

mongoose.connect(mongoURI)
    .then(() => console.log("🚀 SUCCESS: VikVok Database Connected to Atlas"))
    .catch(err => {
        console.error("❌ CONNECTION FAILED:", err.message);
    });

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

// --- API ROUTES ---

// 1. Root Route
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 2. Sign Up (Prevents duplicates via MongoDB unique indexes)
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
            res.status(500).json({ error: "Server Error: " + err.message });
        }
    }
});

// 3. Login
app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email, password });
        if (user) {
            res.json({ username: user.username });
        } else {
            res.status(401).json({ error: "Invalid credentials" });
        }
    } catch (err) {
        res.status(500).json({ error: "Login failed" });
    }
});

// 4. Feed
app.get('/api/videos', async (req, res) => {
    try {
        const videos = await Video.find().sort({ createdAt: -1 });
        res.json(videos);
    } catch (err) {
        res.status(500).json({ error: "Could not fetch videos" });
    }
});

// 5. Upload Video
app.post('/api/upload', async (req, res) => {
    try {
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
    } catch (err) {
        res.status(500).json({ error: "Upload failed" });
    }
});

// 6. Like a Video
app.post('/api/videos/:id/like', async (req, res) => {
    try {
        const video = await Video.findByIdAndUpdate(req.params.id, { $inc: { likes: 1 } }, { new: true });
        res.json(video);
    } catch (err) {
        res.status(500).json({ error: "Like failed" });
    }
});

// 7. Profile Data
app.get('/api/profile/:username', async (req, res) => {
    try {
        const user = await User.findOne({ username: req.params.username });
        if (user) {
            const userVideos = await Video.find({ username: req.params.username });
            res.json({ user, videos: userVideos });
        } else {
            res.status(404).json({ error: "User not found" });
        }
    } catch (err) {
        res.status(500).json({ error: "Profile fetch failed" });
    }
});

// Start
app.listen(PORT, () => {
    console.log(`📡 VikVok Live Server online at port ${PORT}`);
});

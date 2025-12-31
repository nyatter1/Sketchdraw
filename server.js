const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const app = express();

// Increased limit to 50mb to handle Profile Pictures and Post Images
app.use(express.json({ limit: '50mb' })); 
app.use(cors());
app.use(express.static('public'));

// --- MONGODB CONNECTION ---
const MONGO_URI = 'mongodb+srv://hayden:123password123@cluster0.kzhhujn.mongodb.net/nyatter?retryWrites=true&w=majority&appName=Cluster0'; 
mongoose.connect(MONGO_URI)
    .then(() => console.log("✅ DB Connected"))
    .catch(err => console.log("❌ DB Error:", err));

// --- SCHEMAS ---

// Updated User Schema: Now stores Email, Password, and PFP
const User = mongoose.model('User', new mongoose.Schema({
    username: { type: String, unique: true, required: true },
    email: { type: String, unique: true, required: true },
    password: { type: String, required: true },
    pfp: { type: String, default: null }, // Stores the Base64 image
    joinedAt: { type: Number, default: Date.now }
}));

const Post = mongoose.model('Post', new mongoose.Schema({
    user: String,
    text: String,
    img: String,
    likes: { type: Array, default: [] },
    replies: { type: Array, default: [] },
    pinned: { type: Boolean, default: false },
    timestamp: { type: Number, default: Date.now }
}));

const Notification = mongoose.model('Notification', new mongoose.Schema({
    toUser: String,
    fromUser: String,
    type: { type: String, default: 'tag' },
    read: { type: Boolean, default: false },
    timestamp: { type: Number, default: Date.now }
}));

// --- HELPERS ---
const handleTags = async (text, fromUser) => {
    const tags = text.match(/@(\w+)/g);
    if (tags) {
        for (let tag of tags) {
            const toUser = tag.replace('@', '');
            if (toUser !== fromUser) {
                await new Notification({ toUser, fromUser }).save();
            }
        }
    }
};

// --- AUTH ROUTES ---

// NEW: Signup with Email, Password, and PFP
app.post('/api/signup', async (req, res) => {
    try {
        const { username, email, password, pfp } = req.body;
        
        // Check if username OR email already exists
        const existing = await User.findOne({ $or: [{ username }, { email }] });
        if (existing) {
            return res.status(400).json({ error: "Username or Email already taken." });
        }

        const newUser = new User({ username, email, password, pfp });
        await newUser.save();
        
        // Return the user data (excluding password for safety)
        res.json({ success: true, user: { username, pfp } });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: "Server Error" });
    }
});

// NEW: Login with Username/Email and Password
app.post('/api/login', async (req, res) => {
    try {
        const { identifier, password } = req.body; // Identifier can be username OR email

        // Find user by username OR email
        const user = await User.findOne({ 
            $or: [{ username: identifier }, { email: identifier }] 
        });

        if (!user || user.password !== password) {
            return res.status(401).json({ error: "Invalid credentials" });
        }

        // Return success and the user's PFP so the frontend can update
        res.json({ success: true, user: { username: user.username, pfp: user.pfp } });
    } catch (e) {
        res.status(500).json({ error: "Login failed" });
    }
});

// Get all users (includes PFP now)
app.get('/api/users', async (req, res) => {
    const users = await User.find().select('username pfp joinedAt').sort({ joinedAt: -1 });
    res.json(users);
});

// --- POST ROUTES ---

app.get('/api/posts', async (req, res) => {
    const posts = await Post.find().sort({ pinned: -1, timestamp: -1 });
    // In a production app, we would join the User table here to get the latest PFP.
    // For now, the frontend will map the User list to the Posts to show the correct PFP.
    res.json(posts);
});

app.post('/api/posts', async (req, res) => {
    const newPost = new Post(req.body);
    await newPost.save();
    await handleTags(req.body.text, req.body.user);
    res.status(201).json(newPost);
});

app.post('/api/posts/like', async (req, res) => {
    const { id, user } = req.body;
    const post = await Post.findById(id);
    if(post) {
        post.likes.includes(user) ? post.likes = post.likes.filter(u => u !== user) : post.likes.push(user);
        await post.save();
        res.json(post);
    }
});

app.post('/api/posts/reply', async (req, res) => {
    const { id, user, text } = req.body;
    const post = await Post.findById(id);
    if(post) {
        post.replies.push({ user, text });
        await post.save();
        await handleTags(text, user);
        res.json(post);
    }
});

// --- ADMIN ROUTES ---
app.post('/api/posts/delete', async (req, res) => {
    const { id, user } = req.body;
    const post = await Post.findById(id);
    if (post && (post.user === user || user === "HaydenDev")) {
        await Post.findByIdAndDelete(id);
        res.json({ success: true });
    } else { res.status(403).send("Unauthorized"); }
});

app.post('/api/posts/pin', async (req, res) => {
    const { id, user } = req.body;
    if (user !== "HaydenDev") return res.status(403).send("Unauthorized");
    const post = await Post.findById(id);
    post.pinned = !post.pinned;
    await post.save();
    res.json(post);
});

// --- NOTIFICATION ROUTES ---
app.get('/api/notifications/:user', async (req, res) => {
    const notifs = await Notification.find({ toUser: req.params.user, read: false });
    res.json(notifs);
});

app.post('/api/notifications/clear', async (req, res) => {
    await Notification.findByIdAndDelete(req.body.id);
    res.json({ success: true });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Nyatter Core Live on ${PORT}`));

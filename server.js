const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const app = express();

// Set high limits for Base64 Profile Pictures and Images
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ limit: '100mb', extended: true }));
app.use(cors());
app.use(express.static('public'));

// --- DATABASE CONNECTION ---
const MONGO_URI = 'mongodb+srv://hayden:123password123@cluster0.kzhhujn.mongodb.net/nyatter?retryWrites=true&w=majority&appName=Cluster0'; 

mongoose.connect(MONGO_URI)
    .then(() => console.log("🚀 Quantum Database Linked"))
    .catch(err => console.error("❌ Link Failure:", err));

// --- SCHEMAS ---
const UserSchema = new mongoose.Schema({
    username: { type: String, unique: true, required: true },
    email: { type: String, unique: true, required: true },
    password: { type: String, required: true },
    pfp: { type: String, default: "" },
    isDev: { type: Boolean, default: false },
    joinedAt: { type: Number, default: Date.now }
});

const PostSchema = new mongoose.Schema({
    user: String,
    userPfp: String, // Storing PFP at time of post for performance
    text: String,
    img: { type: String, default: "" },
    likes: { type: Array, default: [] },
    replies: [{
        user: String,
        userPfp: String,
        text: String,
        timestamp: { type: Number, default: Date.now }
    }],
    pinned: { type: Boolean, default: false },
    timestamp: { type: Number, default: Date.now }
});

const NotificationSchema = new mongoose.Schema({
    toUser: String,
    fromUser: String,
    read: { type: Boolean, default: false },
    timestamp: { type: Number, default: Date.now }
});

const User = mongoose.model('User', UserSchema);
const Post = mongoose.model('Post', PostSchema);
const Notification = mongoose.model('Notification', NotificationSchema);

// --- HELPER: TAGGING SYSTEM ---
const handleMentions = async (text, fromUser) => {
    const mentions = text.match(/@(\w+)/g);
    if (!mentions) return;
    const uniqueMentions = [...new Set(mentions.map(m => m.replace('@', '')))];
    for (const target of uniqueMentions) {
        if (target !== fromUser) {
            await new Notification({ toUser: target, fromUser }).save();
        }
    }
};

// --- AUTHENTICATION ---
app.post('/api/signup', async (req, res) => {
    try {
        const { username, email, password, pfp } = req.body;
        const exists = await User.findOne({ $or: [{ username }, { email }] });
        if (exists) return res.status(400).json({ error: "Identity already exists in the grid." });

        const isDev = username === "HaydenDev";
        const newUser = new User({ username, email, password, pfp, isDev });
        await newUser.save();
        res.json({ success: true, user: { username, pfp, isDev } });
    } catch (e) { res.status(500).json({ error: "Signup Failed" }); }
});

app.post('/api/login', async (req, res) => {
    const { identifier, password } = req.body;
    const user = await User.findOne({ $or: [{ username: identifier }, { email: identifier }] });
    if (!user || user.password !== password) return res.status(401).json({ error: "Invalid Credentials" });
    res.json({ success: true, user: { username: user.username, pfp: user.pfp, isDev: user.isDev } });
});

app.post('/api/user/update', async (req, res) => {
    const { oldUsername, newUsername, newPassword, newPfp } = req.body;
    try {
        const user = await User.findOne({ username: oldUsername });
        if (!user) return res.status(404).json({ error: "User not found" });

        if (newUsername) user.username = newUsername;
        if (newPassword) user.password = newPassword;
        if (newPfp) user.pfp = newPfp;

        await user.save();
        if (newUsername && newUsername !== oldUsername) {
            await Post.updateMany({ user: oldUsername }, { user: newUsername, userPfp: user.pfp });
        }
        res.json({ success: true, user: { username: user.username, pfp: user.pfp, isDev: user.isDev } });
    } catch (e) { res.status(400).json({ error: "Update rejected by system." }); }
});

// --- FEED & INTERACTION ---
app.get('/api/posts', async (req, res) => {
    const posts = await Post.find().sort({ pinned: -1, timestamp: -1 }).limit(100);
    res.json(posts);
});

app.post('/api/posts', async (req, res) => {
    try {
        const { user, text, img } = req.body;
        const userData = await User.findOne({ username: user });
        const post = new Post({ 
            user, 
            userPfp: userData ? userData.pfp : "", 
            text, 
            img 
        });
        await post.save();
        await handleMentions(text, user);
        res.status(201).json(post);
    } catch (e) { res.status(500).json({ error: "Transmission failed" }); }
});

app.post('/api/posts/reply', async (req, res) => {
    const { id, user, text } = req.body;
    const userData = await User.findOne({ username: user });
    const post = await Post.findById(id);
    if (post) {
        post.replies.push({ user, userPfp: userData ? userData.pfp : "", text });
        await post.save();
        await handleMentions(text, user);
        res.json(post);
    } else { res.status(404).send("Post missing"); }
});

app.post('/api/posts/like', async (req, res) => {
    const { id, user } = req.body;
    const post = await Post.findById(id);
    if (post) {
        post.likes.includes(user) ? post.likes = post.likes.filter(u => u !== user) : post.likes.push(user);
        await post.save();
        res.json(post);
    }
});

// --- ADMIN CONTROL PANEL LOGIC ---
app.post('/api/admin/action', async (req, res) => {
    const { adminUser, action, targetId } = req.body;
    if (adminUser !== "HaydenDev") return res.status(403).json({ error: "Access Denied" });

    try {
        switch (action) {
            case 'WIPE_ALL':
                await User.deleteMany({});
                await Post.deleteMany({});
                await Notification.deleteMany({});
                return res.json({ success: true, message: "System Reset Successful" });
            
            case 'DELETE_USER':
                await User.deleteOne({ username: targetId });
                await Post.deleteMany({ user: targetId });
                return res.json({ success: true, message: `User ${targetId} Purged` });

            case 'DELETE_POST':
                await Post.findByIdAndDelete(targetId);
                return res.json({ success: true });

            case 'TOGGLE_PIN':
                const post = await Post.findById(targetId);
                if (post) {
                    post.pinned = !post.pinned;
                    await post.save();
                }
                return res.json({ success: true });

            default:
                return res.status(400).json({ error: "Unknown Protocol" });
        }
    } catch (e) { res.status(500).json({ error: "Admin protocol failure" }); }
});

// --- SYSTEM ROUTES ---
app.get('/api/users', async (req, res) => {
    const users = await User.find({}, 'username pfp joinedAt').sort({ joinedAt: -1 });
    res.json(users);
});

app.get('/api/notifications/:user', async (req, res) => {
    const notifs = await Notification.find({ toUser: req.params.user, read: false });
    res.json(notifs);
});

app.post('/api/notifications/clear', async (req, res) => {
    await Notification.findByIdAndDelete(req.body.id);
    res.json({ success: true });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🛰️ Nyatter Core Online: Port ${PORT}`));

const express = require("express");
const router = express.Router();
const User = require("../models/User");

// Register a new user
router.post("/signup", async (req, res) => {
    try {
        const { username, email, password } = req.body;

        if (!username || !email || !password) {
            return res.status(400).json({ status: "error", msg: "Username, email, and password are required" });
        }

        // Check if username or email already exists
        const existingUser = await User.findOne({
            $or: [{ username }, { email }]
        });

        if (existingUser) {
            if (existingUser.username === username) {
                return res.status(400).json({ status: "error", msg: "Username already exists" });
            }
            return res.status(400).json({ status: "error", msg: "Email already registered" });
        }

        // Plaintext password for now (add hashing in production)
        const newUser = await User.create({ username, email, password });
        res.json({ status: "success", user: newUser });
    } catch (err) {
        res.status(500).json({ status: "error", msg: err.message });
    }
});

// Google Login (Simulated/OAuth handler)
router.post("/google-auth", async (req, res) => {
    try {
        const { email, name } = req.body;

        // Ensure email is provided
        if (!email) {
            return res.status(400).json({ status: "error", msg: "Email is required from Google." });
        }

        // Check if user exists by email
        let user = await User.findOne({ email: email });

        if (!user) {
            // If user doesn't exist, create them
            let simulatedUsername = email.split('@')[0];

            // Ensure username uniqueness
            const existingUsername = await User.findOne({ username: simulatedUsername });
            if (existingUsername) {
                simulatedUsername = simulatedUsername + Math.floor(Math.random() * 10000);
            }

            // Register them automatically via Google
            user = await User.create({
                username: simulatedUsername,
                email: email,
                password: "oauth-placeholder-" + Math.random().toString(36).substring(2),
                score: 0
            });
        }

        // Return success and user data
        res.json({ status: "success", user });
    } catch (err) {
        res.status(500).json({ status: "error", msg: err.message });
    }
});

// Login user
router.post("/signin", async (req, res) => {
    try {
        const { username, password } = req.body;

        // The 'username' field can actually be either username or email
        const user = await User.findOne({
            $or: [{ username: username }, { email: username }]
        });

        if (!user || user.password !== password) {
            return res.status(401).json({ status: "error", msg: "Invalid credentials" });
        }

        if (user.banned) {
            return res.status(403).json({ status: "error", msg: "Your account has been permanently banned." });
        }

        if (user.suspended) {
            if (user.suspendedUntil && new Date() < user.suspendedUntil) {
                const until = new Date(user.suspendedUntil).toLocaleDateString();
                return res.status(403).json({ status: "error", msg: `Your account is suspended until ${until}.` });
            }
            user.suspended = false;
            user.suspendedUntil = null;
            await user.save();
        }

        res.json({ status: "success", user });
    } catch (err) {
        res.status(500).json({ status: "error", msg: err.message });
    }
});

// Get Leaderboard (Top 50 users by score)
router.get("/leaderboard", async (req, res) => {
    try {
        const topUsers = await User.find({ role: { $ne: 'admin' } }).sort({ score: -1 }).limit(50).select("username score");
        res.json(topUsers);
    } catch (err) {
        res.status(500).json({ status: "error", msg: err.message });
    }
});

// Get User Profile & Rank
router.get("/profile/:username", async (req, res) => {
    try {
        const username = req.params.username;
        const user = await User.findOne({ username }).select("username score");

        if (!user) {
            return res.status(404).json({ status: "error", msg: "User not found" });
        }

        // Calculate Rank (how many users have a strictly higher score?)
        const higherScoringUsers = await User.countDocuments({ score: { $gt: user.score || 0 } });
        const rank = higherScoringUsers + 1;

        res.json({
            status: "success",
            user: {
                username: user.username,
                score: user.score || 0,
                rank: rank
            }
        });
    } catch (err) {
        res.status(500).json({ status: "error", msg: err.message });
    }
});

module.exports = router;

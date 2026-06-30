// ============================================================
// 🔐 src/routes/auth.js
// ============================================================
const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const auth = require('../middleware/auth');

const router = express.Router();

// Generate JWT
const generateToken = (userId) => {
    return jwt.sign(
        { userId },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRY || '7d' }
    );
};

// =============================================
// 📝 SIGNUP
// =============================================
router.post('/signup', async (req, res) => {
    try {
        const { email, password, name } = req.body;

        // Validate
        if (!email || !password || !name) {
            return res.status(400).json({ error: 'Email, password, and name are required' });
        }

        if (password.length < 8) {
            return res.status(400).json({ error: 'Password must be at least 8 characters' });
        }

        // Check existing user
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(409).json({ error: 'Email already registered' });
        }

        // Create user
        const user = await User.create({ email, password, name });

        // Generate token
        const token = generateToken(user._id);

        res.status(201).json({
            success: true,
            token,
            user: {
                id: user._id,
                email: user.email,
                name: user.name,
                plan: user.plan
            }
        });

    } catch (error) {
        console.error('Signup error:', error);
        res.status(500).json({ error: 'Registration failed' });
    }
});

// =============================================
// 🔑 SIGNIN
// =============================================
router.post('/signin', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password required' });
        }

        // Find user with password
        const user = await User.findOne({ email }).select('+password');
        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Check password
        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Check status
        if (user.status !== 'active') {
            return res.status(403).json({ error: 'Account is suspended' });
        }

        // Generate token
        const token = generateToken(user._id);

        res.json({
            success: true,
            token,
            user: {
                id: user._id,
                email: user.email,
                name: user.name,
                plan: user.plan,
                apiKey: user.apiKey
            }
        });

    } catch (error) {
        console.error('Signin error:', error);
        res.status(500).json({ error: 'Login failed' });
    }
});

// =============================================
// 👤 GET CURRENT USER
// =============================================
router.get('/me', auth, async (req, res) => {
    try {
        const user = await User.findById(req.userId).populate('domains');
        
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json({
            success: true,
            user: {
                id: user._id,
                email: user.email,
                name: user.name,
                plan: user.plan,
                apiKey: user.apiKey,
                domains: user.domains,
                createdAt: user.createdAt
            }
        });

    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch user' });
    }
});

// =============================================
// 🔑 GENERATE API KEY
// =============================================
router.post('/api-key', auth, async (req, res) => {
    try {
        const user = await User.findById(req.userId);
        const apiKey = user.generateAPIKey();
        await user.save();

        res.json({
            success: true,
            apiKey
        });

    } catch (error) {
        res.status(500).json({ error: 'Failed to generate API key' });
    }
});

module.exports = router;

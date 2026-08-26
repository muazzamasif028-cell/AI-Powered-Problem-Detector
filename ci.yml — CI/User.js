// ============================================================
// 👤 src/models/User.js
// ============================================================
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true
    },
    password: {
        type: String,
        required: true,
        minlength: 8,
        select: false // Don't return password by default
    },
    name: {
        type: String,
        required: true,
        trim: true
    },
    // Stripe customer
    stripeCustomerId: String,
    // Domains owned
    domains: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Domain'
    }],
    // Plan
    plan: {
        type: String,
        enum: ['free', 'pro', 'business'],
        default: 'free'
    },
    // API Key
    apiKey: {
        type: String,
        unique: true,
        sparse: true
    },
    // Status
    status: {
        type: String,
        enum: ['active', 'suspended', 'deleted'],
        default: 'active'
    }
}, {
    timestamps: true
});

// Hash password before saving
userSchema.pre('save', async function(next) {
    if (!this.isModified('password')) return next();
    this.password = await bcrypt.hash(this.password, 12);
    next();
});

// Compare password
userSchema.methods.comparePassword = async function(candidatePassword) {
    return bcrypt.compare(candidatePassword, this.password);
};

// Generate API key
userSchema.methods.generateAPIKey = function() {
    const crypto = require('crypto');
    this.apiKey = `sk_live_${crypto.randomBytes(24).toString('hex')}`;
    return this.apiKey;
};

module.exports = mongoose.model('User', userSchema);

// ============================================================
// 🗄️ src/models/User.js
// SUPREME User Model
// ============================================================
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const userSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    password: { type: String, required: true, minlength: 8, select: false },
    
    // Plan
    plan: { type: String, enum: ['free', 'basic', 'pro', 'enterprise'], default: 'free' },
    
    // API Keys
    apiKeys: [{
        key: String,
        name: String,
        createdAt: { type: Date, default: Date.now },
        lastUsed: Date,
        expiresAt: Date
    }],
    
    // Usage
    usage: {
        aiRequests: { type: Number, default: 0 },
        agentsCreated: { type: Number, default: 0 },
        storageUsed: { type: Number, default: 0 }
    },
    
    // Billing
    stripeCustomerId: String,
    paddleCustomerId: String,
    subscriptionId: String,
    subscriptionStatus: { type: String, enum: ['active', 'cancelled', 'past_due', 'none'], default: 'none' },
    
    // Status
    status: { type: String, enum: ['active', 'suspended', 'deleted'], default: 'active' },
    
    // Metadata
    lastLoginAt: Date,
    loginCount: { type: Number, default: 0 }
}, { timestamps: true });

// Hash password
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
userSchema.methods.generateApiKey = function(name = 'default') {
    const key = `sk_${crypto.randomBytes(24).toString('hex')}`;
    this.apiKeys.push({ key, name });
    return key;
};

// Check usage limits
userSchema.methods.checkLimit = function(type) {
    const config = require('../config');
    const plan = config.plans[this.plan];
    
    switch (type) {
        case 'aiRequests': return this.usage.aiRequests < plan.aiRequests;
        case 'agents': return this.usage.agentsCreated < plan.agents;
        case 'storage': return this.usage.storageUsed < parseInt(plan.storage);
        default: return true;
    }
};

module.exports = mongoose.model('User', userSchema);

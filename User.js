// ============================================================
// 🗄️ src/models/User.js
// SUPREME User Model — Complete user schema
// ============================================================
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const userSchema = new mongoose.Schema({
    // Basic Info
    name: {
        type: String,
        required: [true, 'Name is required'],
        trim: true,
        minlength: 2,
        maxlength: 100
    },
    email: {
        type: String,
        required: [true, 'Email is required'],
        unique: true,
        lowercase: true,
        trim: true,
        match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Invalid email format']
    },
    password: {
        type: String,
        required: [true, 'Password is required'],
        minlength: 8,
        select: false
    },
    avatar: {
        type: String,
        default: null
    },

    // Verification
    isEmailVerified: {
        type: Boolean,
        default: false
    },
    emailVerificationToken: String,
    emailVerificationExpires: Date,

    // Password Reset
    passwordResetToken: String,
    passwordResetExpires: Date,
    passwordChangedAt: Date,

    // 2FA
    twoFactorEnabled: {
        type: Boolean,
        default: false
    },
    twoFactorSecret: {
        type: String,
        select: false
    },
    twoFactorBackupCodes: [{
        code: String,
        used: { type: Boolean, default: false }
    }],

    // OAuth Providers
    oauthProviders: [{
        provider: {
            type: String,
            enum: ['google', 'github', 'microsoft', 'apple']
        },
        providerId: String,
        email: String,
        name: String,
        avatar: String,
        accessToken: String,
        refreshToken: String,
        connectedAt: { type: Date, default: Date.now }
    }],

    // Role & Permissions
    role: {
        type: String,
        enum: ['user', 'developer', 'admin', 'superadmin'],
        default: 'user'
    },
    permissions: [{
        type: String,
        enum: [
            'domain:read', 'domain:write', 'domain:delete',
            'ai:read', 'ai:write',
            'billing:read', 'billing:write',
            'user:read', 'user:write', 'user:delete',
            'admin:access'
        ]
    }],

    // Plan
    plan: {
        type: String,
        enum: ['free', 'pro', 'business', 'enterprise'],
        default: 'free'
    },
    planExpiry: Date,

    // API Keys
    apiKeys: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ApiKey'
    }],

    // Status
    status: {
        type: String,
        enum: ['active', 'suspended', 'deleted'],
        default: 'active'
    },

    // Login tracking
    lastLoginAt: Date,
    lastLoginIp: String,
    lastLoginDevice: String,
    lastLoginLocation: String,
    loginCount: { type: Number, default: 0 },
    failedLoginAttempts: { type: Number, default: 0 },
    lockedUntil: Date,

    // Metadata
    metadata: mongoose.Schema.Types.Mixed,
    tags: [String]
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// =============================================
// 📊 INDEXES
// =============================================
userSchema.index({ email: 1 });
userSchema.index({ 'oauthProviders.provider': 1, 'oauthProviders.providerId': 1 });
userSchema.index({ status: 1 });
userSchema.index({ role: 1 });

// =============================================
// 🔐 PRE-SAVE HOOKS
// =============================================
userSchema.pre('save', async function(next) {
    if (!this.isModified('password')) return next();
    
    this.password = await bcrypt.hash(this.password, 12);
    
    if (this.isModified('password') && !this.isNew) {
        this.passwordChangedAt = new Date();
    }
    
    next();
});

// =============================================
// 🎯 METHODS
// =============================================

// Compare password
userSchema.methods.comparePassword = async function(candidatePassword) {
    return bcrypt.compare(candidatePassword, this.password);
};

// Check if password changed after token issued
userSchema.methods.passwordChangedAfter = function(jwtTimestamp) {
    if (this.passwordChangedAt) {
        const changedAt = parseInt(this.passwordChangedAt.getTime() / 1000, 10);
        return jwtTimestamp < changedAt;
    }
    return false;
};

// Generate email verification token
userSchema.methods.generateEmailVerificationToken = function() {
    const token = crypto.randomBytes(32).toString('hex');
    this.emailVerificationToken = crypto.createHash('sha256').update(token).digest('hex');
    this.emailVerificationExpires = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
    return token;
};

// Generate password reset token
userSchema.methods.generatePasswordResetToken = function() {
    const token = crypto.randomBytes(32).toString('hex');
    this.passwordResetToken = crypto.createHash('sha256').update(token).digest('hex');
    this.passwordResetExpires = Date.now() + 60 * 60 * 1000; // 1 hour
    return token;
};

// Generate 2FA backup codes
userSchema.methods.generateBackupCodes = function(count = 8) {
    const codes = [];
    for (let i = 0; i < count; i++) {
        codes.push({
            code: crypto.randomBytes(4).toString('hex').toUpperCase(),
            used: false
        });
    }
    this.twoFactorBackupCodes = codes;
    return codes.map(c => c.code);
};

// Get safe user object (no sensitive data)
userSchema.methods.toSafeObject = function() {
    const obj = this.toObject();
    delete obj.password;
    delete obj.emailVerificationToken;
    delete obj.passwordResetToken;
    delete obj.twoFactorSecret;
    delete obj.__v;
    return obj;
};

// =============================================
// 🔍 STATICS
// =============================================
userSchema.statics.findByEmail = function(email) {
    return this.findOne({ email: email.toLowerCase() });
};

userSchema.statics.findByOAuthProvider = function(provider, providerId) {
    return this.findOne({
        'oauthProviders.provider': provider,
        'oauthProviders.providerId': providerId
    });
};

module.exports = mongoose.model('User', userSchema);

// ============================================================
// 🌌 models/UniversalIdentity.js
// SUPREME Universal Identity — One Identity for Everything
// ============================================================
const mongoose = require('mongoose');

const UniversalIdentitySchema = new mongoose.Schema({
    // Core Identity
    supremeId: {
        type: String,
        unique: true,
        required: true,
        index: true
    },
    
    // Universal Profile
    displayName: String,
    avatar: String,
    bio: String,
    
    // Connected Identities
    identities: [{
        provider: {
            type: String,
            enum: ['google', 'github', 'microsoft', 'apple', 'facebook', 
                   'twitter', 'linkedin', 'discord', 'slack', 'gitlab',
                   'bitbucket', 'spotify', 'stripe', 'custom']
        },
        providerId: String,
        email: String,
        name: String,
        avatar: String,
        accessToken: { type: String, select: false },
        refreshToken: { type: String, select: false },
        connectedAt: { type: Date, default: Date.now },
        lastLoginAt: Date,
        isPrimary: { type: Boolean, default: false }
    }],
    
    // Universal Data
    unifiedProfile: {
        emails: [String],
        phoneNumbers: [String],
        addresses: [{
            type: String,
            street: String,
            city: String,
            state: String,
            country: String,
            zipCode: String,
            isPrimary: Boolean
        }],
        socialLinks: [{
            platform: String,
            url: String
        }]
    },
    
    // AI Memory
    aiMemory: {
        preferences: mongoose.Schema.Types.Mixed,
        learnedTopics: [String],
        interactionHistory: [{
            module: String,
            action: String,
            timestamp: Date,
            context: mongoose.Schema.Types.Mixed
        }],
        personalizedSettings: mongoose.Schema.Types.Mixed
    },
    
    // Connected Services
    connectedServices: [{
        service: String,
        serviceId: String,
        plan: String,
        status: { type: String, enum: ['active', 'suspended', 'cancelled'] },
        addedAt: { type: Date, default: Date.now }
    }],
    
    // Universal Permissions
    permissions: {
        dataSharing: { type: Boolean, default: true },
        aiPersonalization: { type: Boolean, default: true },
        marketingEmails: { type: Boolean, default: false },
        publicProfile: { type: Boolean, default: false }
    },
    
    // Security
    securityLevel: {
        type: String,
        enum: ['standard', 'enhanced', 'maximum'],
        default: 'standard'
    },
    mfaEnabled: { type: Boolean, default: false },
    mfaMethods: [{
        type: { type: String, enum: ['totp', 'sms', 'email', 'hardware_key', 'biometric'] },
        enabled: Boolean,
        verifiedAt: Date
    }],
    
    // Metadata
    metadata: mongoose.Schema.Types.Mixed,
    tags: [String],
    
    // Platform-wide stats
    stats: {
        totalLogins: { type: Number, default: 0 },
        lastLoginAt: Date,
        lastLoginIp: String,
        lastLoginDevice: String,
        totalApiCalls: { type: Number, default: 0 },
        totalStorageUsed: { type: Number, default: 0 }, // bytes
        totalBandwidthUsed: { type: Number, default: 0 } // bytes
    }
    
}, {
    timestamps: true,
    toJSON: { virtuals: true }
});

// =============================================
// 🔗 VIRTUALS
// =============================================
UniversalIdentitySchema.virtual('primaryEmail').get(function() {
    const primary = this.identities.find(i => i.isPrimary);
    return primary?.email || this.unifiedProfile.emails[0];
});

UniversalIdentitySchema.virtual('connectedProviders').get(function() {
    return this.identities.map(i => i.provider);
});

// =============================================
// 📊 INDEXES
// =============================================
UniversalIdentitySchema.index({ 'identities.email': 1 });
UniversalIdentitySchema.index({ 'unifiedProfile.emails': 1 });
UniversalIdentitySchema.index({ 'connectedServices.service': 1 });

module.exports = mongoose.model('UniversalIdentity', UniversalIdentitySchema);

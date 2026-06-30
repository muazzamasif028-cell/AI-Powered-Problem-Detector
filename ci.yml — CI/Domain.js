// ============================================================
// 🌐 src/models/Domain.js
// ============================================================
const mongoose = require('mongoose');

const domainSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    domainName: {
        type: String,
        required: true,
        lowercase: true,
        trim: true
    },
    tld: {
        type: String,
        required: true,
        lowercase: true
    },
    fullDomain: {
        type: String,
        unique: true
    },
    status: {
        type: String,
        enum: ['active', 'pending', 'expired', 'transferred', 'deleted'],
        default: 'pending'
    },
    registrationDate: {
        type: Date,
        default: Date.now
    },
    expiryDate: Date,
    autoRenew: {
        type: Boolean,
        default: true
    },
    nameservers: [String],
    dnsRecords: [{
        type: { type: String, enum: ['A', 'AAAA', 'CNAME', 'MX', 'TXT', 'NS'] },
        name: String,
        value: String,
        ttl: { type: Number, default: 3600 }
    }],
    ssl: {
        status: { type: String, enum: ['none', 'pending', 'active', 'error'], default: 'none' },
        issuedAt: Date,
        expiresAt: Date,
        provider: { type: String, default: 'letsencrypt' }
    },
    websiteDeployed: {
        type: Boolean,
        default: false
    },
    websiteUrl: String,
    stripeSubscriptionId: String,
    price: Number,
    currency: { type: String, default: 'USD' }
}, {
    timestamps: true
});

// Set full domain before saving
domainSchema.pre('save', function(next) {
    this.fullDomain = `${this.domainName}.${this.tld}`;
    if (!this.expiryDate) {
        this.expiryDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000); // 1 year
    }
    next();
});

module.exports = mongoose.model('Domain', domainSchema);

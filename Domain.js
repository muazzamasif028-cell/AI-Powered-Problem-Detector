// ============================================================
// 🗄️ models/Domain.js
// SUPREME Domain Model v11.0
// ============================================================
const mongoose = require('mongoose');

const DNSRecordSchema = new mongoose.Schema({
    type: {
        type: String,
        enum: ['A', 'AAAA', 'CNAME', 'MX', 'TXT', 'NS', 'SRV', 'CAA', 'CERT', 'PTR', 'SOA'],
        required: true
    },
    name: { type: String, default: '@' },
    value: { type: String, required: true },
    ttl: { type: Number, default: 3600 },
    priority: { type: Number, default: null },
    proxied: { type: Boolean, default: false },
    locked: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now }
});

const SSLCertificateSchema = new mongoose.Schema({
    type: {
        type: String,
        enum: ['free', 'premium', 'wildcard', 'enterprise'],
        default: 'free'
    },
    status: {
        type: String,
        enum: ['pending', 'issued', 'active', 'expired', 'revoked', 'failed'],
        default: 'pending'
    },
    provider: { type: String, default: 'letsencrypt' },
    certificateId: String,
    issuedAt: Date,
    expiresAt: Date,
    autoRenew: { type: Boolean, default: true },
    domains: [String],
    fingerprint: String,
    issuer: String
});

const EmailSetupSchema = new mongoose.Schema({
    status: {
        type: String,
        enum: ['not_configured', 'configuring', 'active', 'failed'],
        default: 'not_configured'
    },
    provider: { type: String, default: 'google_workspace' },
    accounts: [{
        email: String,
        type: { type: String, enum: ['admin', 'user', 'catchall'], default: 'user' },
        status: { type: String, enum: ['active', 'suspended', 'pending'], default: 'pending' }
    }],
    spfRecord: String,
    dkimRecord: String,
    dmarcRecord: String,
    mxRecords: [String]
});

const DomainSchema = new mongoose.Schema({
    // Basic Info
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    domainName: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true,
        index: true
    },
    tld: {
        type: String,
        required: true,
        lowercase: true
    },
    
    // Registration Info
    registrar: {
        type: String,
        enum: ['cloudflare', 'namecheap', 'godaddy', 'opensrs', 'enom', 'custom'],
        required: true
    },
    registrarId: String,
    registrationDate: { type: Date, default: Date.now },
    expiryDate: Date,
    autoRenew: { type: Boolean, default: true },
    renewAmount: Number,
    currency: { type: String, default: 'USD' },
    
    // Status
    status: {
        type: String,
        enum: [
            'searching', 'available', 'registering', 'registered',
            'transferring', 'transferring_in', 'transfer_complete',
            'expired', 'suspended', 'locked', 'deleted',
            'error'
        ],
        default: 'searching'
    },
    transferLock: { type: Boolean, default: true },
    whoisPrivacy: { type: Boolean, default: true },
    dnssecEnabled: { type: Boolean, default: false },
    
    // DNS Records
    dnsRecords: [DNSRecordSchema],
    nameservers: [{
        host: String,
        ip: String,
        priority: { type: Number, default: 1 }
    }],
    
    // SSL
    ssl: SSLCertificateSchema,
    
    // Email
    email: EmailSetupSchema,
    
    // WHOIS Info
    whoisInfo: {
        registrant: String,
        organization: String,
        email: String,
        phone: String,
        address: String,
        city: String,
        state: String,
        country: String,
        zipCode: String
    },
    
    // Connected Services
    connectedServices: {
        hosting: { type: Boolean, default: false },
        cloud: { type: Boolean, default: false },
        cdn: { type: Boolean, default: false },
        analytics: { type: Boolean, default: false },
        aiAgent: { type: Boolean, default: false },
        website: { type: Boolean, default: false }
    },
    
    // One-Click Deploy Status
    deployStatus: {
        type: String,
        enum: ['not_started', 'dns_configuring', 'ssl_issuing', 'hosting_provisioning', 
               'email_setting', 'ai_deploying', 'complete', 'failed'],
        default: 'not_started'
    },
    deployProgress: { type: Number, default: 0, min: 0, max: 100 },
    deployLog: [{
        step: String,
        status: String,
        message: String,
        timestamp: { type: Date, default: Date.now }
    }],
    
    // Metadata
    tags: [String],
    notes: String,
    isPremium: { type: Boolean, default: false },
    premiumPrice: Number,
    
    // AI Generated Data
    aiGenerated: {
        suggested: { type: Boolean, default: false },
        alternatives: [String],
        brandScore: Number,
        seoScore: Number
    }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// =============================================
// 📊 INDEXES
// =============================================
DomainSchema.index({ userId: 1, status: 1 });
DomainSchema.index({ expiryDate: 1 }, { sparse: true });
DomainSchema.index({ 'ssl.expiresAt': 1 }, { sparse: true });
DomainSchema.index({ domainName: 'text', tld: 'text' });

// =============================================
// 🔗 VIRTUALS
// =============================================
DomainSchema.virtual('fullDomain').get(function() {
    return `${this.domainName}.${this.tld}`;
});

DomainSchema.virtual('daysUntilExpiry').get(function() {
    if (!this.expiryDate) return null;
    return Math.ceil((this.expiryDate - new Date()) / (1000 * 60 * 60 * 24));
});

DomainSchema.virtual('isExpiringSoon').get(function() {
    const days = this.daysUntilExpiry;
    return days !== null && days <= 30 && days > 0;
});

DomainSchema.virtual('isExpired').get(function() {
    const days = this.daysUntilExpiry;
    return days !== null && days <= 0;
});

// =============================================
// 🎯 METHODS
// =============================================
DomainSchema.methods.addDNSRecord = function(record) {
    this.dnsRecords.push(record);
    return this.save();
};

DomainSchema.methods.removeDNSRecord = function(recordId) {
    this.dnsRecords.pull(recordId);
    return this.save();
};

DomainSchema.methods.updateDeployProgress = function(step, status, message, progress) {
    this.deployLog.push({ step, status, message, timestamp: new Date() });
    this.deployProgress = progress;
    if (status === 'complete' && progress >= 100) {
        this.deployStatus = 'complete';
    }
    return this.save();
};

// =============================================
// 🔍 STATICS
// =============================================
DomainSchema.statics.findExpiringSoon = function(days = 30) {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + days);
    
    return this.find({
        expiryDate: { $lte: futureDate, $gte: new Date() },
        status: 'registered',
        autoRenew: true
    });
};

DomainSchema.statics.findByUser = function(userId, filters = {}) {
    return this.find({ userId, ...filters })
        .sort({ createdAt: -1 })
        .select('-deployLog');
};

// =============================================
// 🤫 EXPORT
// =============================================
module.exports = mongoose.model('Domain', DomainSchema);

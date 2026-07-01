// ============================================================
// 📊 src/models/Activity.js
// User Activity & System Events Model
// ============================================================
const mongoose = require('mongoose');

const ActivitySchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        index: true
    },
    type: {
        type: String,
        enum: [
            // Domain events
            'domain.registered', 'domain.renewed', 'domain.transferred', 'domain.deleted',
            'domain.dns_added', 'domain.dns_updated', 'domain.ssl_issued',
            
            // AI events
            'ai.chat_completed', 'ai.agent_created', 'ai.agent_deployed', 'ai.model_trained',
            
            // Cloud events
            'cloud.instance_created', 'cloud.instance_deleted', 'cloud.storage_uploaded',
            
            // Billing events
            'billing.invoice_generated', 'billing.payment_received', 'billing.refund_processed',
            
            // Auth events
            'auth.login', 'auth.logout', 'auth.password_changed', 'auth.mfa_enabled',
            
            // System events
            'system.deployment', 'system.backup', 'system.maintenance', 'system.upgrade',
            'system.feature_enabled', 'system.feature_disabled'
        ]
    },
    action: String,
    description: String,
    status: {
        type: String,
        enum: ['success', 'failed', 'pending', 'in_progress'],
        default: 'success'
    },
    metadata: mongoose.Schema.Types.Mixed,
    ip: String,
    userAgent: String,
    duration: Number, // milliseconds
    relatedId: mongoose.Schema.Types.ObjectId,
    relatedModel: String
}, {
    timestamps: true
});

ActivitySchema.index({ userId: 1, createdAt: -1 });
ActivitySchema.index({ type: 1, createdAt: -1 });
ActivitySchema.index({ status: 1 });
ActivitySchema.index({ createdAt: -1 });

// Auto-delete activities older than 90 days
ActivitySchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

module.exports = mongoose.model('Activity', ActivitySchema);

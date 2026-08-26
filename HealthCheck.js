// ============================================================
// 🏥 src/models/HealthCheck.js
// Service Health Check Model
// ============================================================
const mongoose = require('mongoose');

const HealthCheckSchema = new mongoose.Schema({
    service: {
        type: String,
        required: true,
        enum: ['api', 'dashboard', 'ai', 'storage', 'dns', 'billing', 'domain', 'auth', 'database', 'redis', 'cdn']
    },
    status: {
        type: String,
        enum: ['healthy', 'degraded', 'down', 'maintenance'],
        default: 'healthy'
    },
    responseTime: Number, // milliseconds
    uptime: Number, // seconds
    version: String,
    region: String,
    lastChecked: { type: Date, default: Date.now },
    lastError: {
        message: String,
        timestamp: Date,
        stack: String
    },
    metrics: {
        cpu: Number,
        memory: Number,
        disk: Number,
        activeConnections: Number,
        requestsPerMinute: Number
    },
    incidents: [{
        startedAt: Date,
        resolvedAt: Date,
        duration: Number,
        severity: { type: String, enum: ['minor', 'major', 'critical'] },
        description: String,
        status: { type: String, enum: ['open', 'investigating', 'identified', 'monitoring', 'resolved'] }
    }]
}, {
    timestamps: true
});

HealthCheckSchema.index({ service: 1, lastChecked: -1 });
HealthCheckSchema.index({ status: 1 });
HealthCheckSchema.index({ service: 1, status: 1 });

module.exports = mongoose.model('HealthCheck', HealthCheckSchema);

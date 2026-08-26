// ============================================================
// 📝 src/services/observability/activity.service.js
// Activity Logger — Track everything happening
// ============================================================
const Activity = require('../../models/Activity');
const EventEmitter = require('events');

class ActivityService extends EventEmitter {
    constructor() {
        super();
        this.recentActivities = []; // In-memory for real-time display
        this.maxRecent = 100;
    }

    /**
     * Log an activity
     */
    async log(params) {
        const {
            userId,
            type,
            action,
            description,
            status = 'success',
            metadata = {},
            relatedId,
            relatedModel,
            duration
        } = params;

        // Create activity record
        const activity = await Activity.create({
            userId,
            type,
            action,
            description,
            status,
            metadata,
            relatedId,
            relatedModel,
            duration,
            ip: params.ip,
            userAgent: params.userAgent
        });

        // Add to recent activities (in-memory)
        this.recentActivities.unshift(activity);
        if (this.recentActivities.length > this.maxRecent) {
            this.recentActivities.pop();
        }

        // Emit real-time event
        this.emit('activity', activity);

        return activity;
    }

    /**
     * Log domain activity
     */
    async logDomain(userId, action, domainName, status = 'success') {
        const typeMap = {
            'register': 'domain.registered',
            'renew': 'domain.renewed',
            'transfer': 'domain.transferred',
            'delete': 'domain.deleted'
        };

        const descriptionMap = {
            'register': `🌐 Domain registered: ${domainName}`,
            'renew': `🔄 Domain renewed: ${domainName}`,
            'transfer': `📦 Domain transferred: ${domainName}`,
            'delete': `🗑️ Domain deleted: ${domainName}`
        };

        return this.log({
            userId,
            type: typeMap[action] || 'domain.registered',
            action,
            description: descriptionMap[action] || `Domain ${action}: ${domainName}`,
            status,
            metadata: { domainName }
        });
    }

    /**
     * Log AI activity
     */
    async logAI(userId, action, details, status = 'success') {
        return this.log({
            userId,
            type: `ai.${action}`,
            action,
            description: `🤖 AI ${action}: ${details}`,
            status,
            metadata: { details }
        });
    }

    /**
     * Log billing activity
     */
    async logBilling(userId, action, amount, status = 'success') {
        return this.log({
            userId,
            type: `billing.${action}`,
            action,
            description: `💰 ${action}: $${amount}`,
            status,
            metadata: { amount }
        });
    }

    /**
     * Log system activity
     */
    async logSystem(action, description, status = 'success') {
        return this.log({
            type: `system.${action}`,
            action,
            description: `⚙️ System: ${description}`,
            status
        });
    }

    /**
     * Get user activities
     */
    async getUserActivities(userId, limit = 50, type = null) {
        const query = { userId };
        if (type) query.type = type;

        return Activity.find(query)
            .sort({ createdAt: -1 })
            .limit(limit);
    }

    /**
     * Get recent activities (all users)
     */
    getRecentActivities(limit = 20) {
        return this.recentActivities.slice(0, limit);
    }

    /**
     * Get live activity feed (for dashboard)
     */
    getLiveFeed() {
        return this.recentActivities.slice(0, 10).map(a => ({
            icon: this.getActivityIcon(a.type),
            description: a.description,
            time: this.formatTime(a.createdAt),
            status: a.status,
            type: a.type
        }));
    }

    /**
     * Get activity icon
     */
    getActivityIcon(type) {
        const icons = {
            'domain.registered': '🌐',
            'domain.renewed': '🔄',
            'domain.transferred': '📦',
            'domain.deleted': '🗑️',
            'domain.ssl_issued': '🔒',
            'ai.chat_completed': '🤖',
            'ai.agent_created': '🧠',
            'billing.invoice_generated': '🧾',
            'billing.payment_received': '💰',
            'auth.login': '🔑',
            'system.deployment': '🚀',
            'system.backup': '💾',
            'system.maintenance': '🔧'
        };
        return icons[type] || '📌';
    }

    /**
     * Format relative time
     */
    formatTime(date) {
        const seconds = Math.floor((new Date() - new Date(date)) / 1000);
        
        if (seconds < 60) return 'Just now';
        if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
        if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
        return `${Math.floor(seconds / 86400)}d ago`;
    }

    /**
     * Get activity stats
     */
    async getStats(days = 7) {
        const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
        
        const stats = await Activity.aggregate([
            { $match: { createdAt: { $gte: startDate } } },
            { $group: {
                _id: '$type',
                count: { $sum: 1 },
                successCount: {
                    $sum: { $cond: [{ $eq: ['$status', 'success'] }, 1, 0] }
                }
            }},
            { $sort: { count: -1 } }
        ]);

        return {
            period: `${days} days`,
            totalActivities: stats.reduce((sum, s) => sum + s.count, 0),
            byType: stats,
            successRate: stats.length > 0 
                ? ((stats.reduce((sum, s) => sum + s.successCount, 0) / 
                    stats.reduce((sum, s) => sum + s.count, 0)) * 100).toFixed(1) + '%'
                : '100%'
        };
    }
}

module.exports = new ActivityService();

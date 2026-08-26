// ============================================================
// 📊 workers/analytics.worker.js
// SUPREME Analytics Processing Worker v11.0
// Handles: Metrics aggregation, reporting, trends, alerts
// ============================================================
const { parentPort, workerData } = require('worker_threads');

const log = (message, data = {}) => {
    console.log(`[ANALYTICS-WORKER] ${new Date().toISOString()} | ${message}`);
};

class AnalyticsWorker {
    constructor() {
        this.status = 'INITIALIZING';
        this.metrics = new Map();
        this.alerts = [];
        this.windowSize = 3600; // 1 hour window
        this.startTime = Date.now();
        this.processedEvents = 0;
    }

    async initialize() {
        log('Analytics worker initializing...');
        
        // Initialize metric collectors
        this.metrics.set('api_requests', { total: 0, byEndpoint: {}, byStatus: {} });
        this.metrics.set('response_times', []);
        this.metrics.set('error_rates', { total: 0, byType: {} });
        this.metrics.set('active_users', { current: 0, peak: 0, history: [] });
        this.metrics.set('llm_usage', { total: 0, byModel: {}, tokens: 0 });
        
        this.status = 'READY';
        log('✅ Analytics worker ready');
        
        parentPort.postMessage({
            type: 'worker:ready',
            workerId: workerData?.workerId || 'analytics-1',
            timestamp: new Date().toISOString()
        });
    }

    /**
     * Process analytics event
     */
    async processEvent(data) {
        const { event, payload, timestamp } = data;
        this.processedEvents++;
        
        switch (event) {
            case 'api_request':
                this.trackAPIRequest(payload);
                break;
                
            case 'user_action':
                this.trackUserAction(payload);
                break;
                
            case 'error':
                this.trackError(payload);
                break;
                
            case 'llm_call':
                this.trackLLMUsage(payload);
                break;
                
            case 'performance':
                this.trackPerformance(payload);
                break;
        }
        
        // Check alert thresholds
        this.checkAlerts();
        
        return { success: true, processed: this.processedEvents };
    }

    /**
     * Track API requests
     */
    trackAPIRequest(payload) {
        const metrics = this.metrics.get('api_requests');
        metrics.total++;
        
        const endpoint = payload.endpoint || 'unknown';
        metrics.byEndpoint[endpoint] = (metrics.byEndpoint[endpoint] || 0) + 1;
        
        const status = payload.status || 200;
        const statusGroup = Math.floor(status / 100) + 'xx';
        metrics.byStatus[statusGroup] = (metrics.byStatus[statusGroup] || 0) + 1;
    }

    /**
     * Track user actions
     */
    trackUserAction(payload) {
        const users = this.metrics.get('active_users');
        users.current = payload.activeCount || users.current;
        users.peak = Math.max(users.peak, users.current);
        users.history.push({ count: users.current, timestamp: new Date().toISOString() });
        
        // Keep last 24 hours
        if (users.history.length > 1440) users.history.shift();
    }

    /**
     * Track errors
     */
    trackError(payload) {
        const errors = this.metrics.get('error_rates');
        errors.total++;
        
        const type = payload.type || 'unknown';
        errors.byType[type] = (errors.byType[type] || 0) + 1;
    }

    /**
     * Track LLM usage
     */
    trackLLMUsage(payload) {
        const llm = this.metrics.get('llm_usage');
        llm.total++;
        llm.tokens += payload.tokens || 0;
        
        const model = payload.model || 'unknown';
        llm.byModel[model] = (llm.byModel[model] || 0) + 1;
    }

    /**
     * Track performance metrics
     */
    trackPerformance(payload) {
        const times = this.metrics.get('response_times');
        times.push({
            endpoint: payload.endpoint,
            duration: payload.duration,
            timestamp: new Date().toISOString()
        });
        
        // Keep last 1000 entries
        if (times.length > 1000) times.shift();
    }

    /**
     * Check alert thresholds
     */
    checkAlerts() {
        const apiMetrics = this.metrics.get('api_requests');
        const errorMetrics = this.metrics.get('error_rates');
        
        // Error rate > 5%
        if (apiMetrics.total > 100 && (errorMetrics.total / apiMetrics.total) > 0.05) {
            this.createAlert('high_error_rate', 'warning', 
                `Error rate at ${((errorMetrics.total / apiMetrics.total) * 100).toFixed(2)}%`);
        }
        
        // Response time > 2000ms avg
        const times = this.metrics.get('response_times');
        if (times.length > 10) {
            const avg = times.slice(-10).reduce((sum, t) => sum + t.duration, 0) / 10;
            if (avg > 2000) {
                this.createAlert('high_latency', 'warning', `Average response time: ${Math.round(avg)}ms`);
            }
        }
    }

    /**
     * Create alert
     */
    createAlert(type, severity, message) {
        const alert = {
            id: `alert-${Date.now()}`,
            type,
            severity,
            message,
            timestamp: new Date().toISOString(),
            acknowledged: false
        };
        
        this.alerts.push(alert);
        
        // Keep last 100 alerts
        if (this.alerts.length > 100) this.alerts.shift();
        
        // Notify main thread
        parentPort.postMessage({
            type: 'alert:triggered',
            data: alert,
            timestamp: new Date().toISOString()
        });
    }

    /**
     * Generate analytics report
     */
    async generateReport(data) {
        const { type = 'summary', period = '1h' } = data;
        
        const report = {
            type,
            period,
            generatedAt: new Date().toISOString(),
            metrics: {},
            alerts: this.alerts.filter(a => !a.acknowledged)
        };
        
        // API metrics
        const apiMetrics = this.metrics.get('api_requests');
        report.metrics.api = {
            totalRequests: apiMetrics.total,
            topEndpoints: Object.entries(apiMetrics.byEndpoint)
                .sort(([, a], [, b]) => b - a)
                .slice(0, 5)
                .map(([endpoint, count]) => ({ endpoint, count })),
            statusDistribution: apiMetrics.byStatus
        };
        
        // Error metrics
        const errorMetrics = this.metrics.get('error_rates');
        report.metrics.errors = {
            total: errorMetrics.total,
            errorRate: apiMetrics.total > 0 
                ? ((errorMetrics.total / apiMetrics.total) * 100).toFixed(2) + '%' 
                : '0%',
            byType: errorMetrics.byType
        };
        
        // User metrics
        const userMetrics = this.metrics.get('active_users');
        report.metrics.users = {
            current: userMetrics.current,
            peak: userMetrics.peak
        };
        
        // LLM metrics
        const llmMetrics = this.metrics.get('llm_usage');
        report.metrics.llm = {
            totalCalls: llmMetrics.total,
            totalTokens: llmMetrics.tokens,
            byModel: llmMetrics.byModel
        };
        
        // Performance metrics
        const perfMetrics = this.metrics.get('response_times');
        if (perfMetrics.length > 0) {
            const durations = perfMetrics.map(t => t.duration);
            report.metrics.performance = {
                avg: Math.round(durations.reduce((a, b) => a + b, 0) / durations.length),
                min: Math.min(...durations),
                max: Math.max(...durations),
                p95: this.percentile(durations, 95),
                p99: this.percentile(durations, 99)
            };
        }
        
        return report;
    }

    /**
     * Calculate percentile
     */
    percentile(arr, p) {
        const sorted = [...arr].sort((a, b) => a - b);
        const index = Math.ceil((p / 100) * sorted.length) - 1;
        return sorted[index] || 0;
    }

    getStats() {
        return {
            status: this.status,
            processedEvents: this.processedEvents,
            activeAlerts: this.alerts.filter(a => !a.acknowledged).length,
            uptime: Math.floor((Date.now() - this.startTime) / 1000)
        };
    }

    async shutdown() {
        log('Shutting down analytics worker...');
        this.status = 'STOPPED';
    }
}

// =============================================
// 🎯 MESSAGE HANDLER
// =============================================
const worker = new AnalyticsWorker();

parentPort.on('message', async (message) => {
    const { type, data, jobId } = message;
    
    try {
        let result;
        
        switch (type) {
            case 'analytics:event':
                result = await worker.processEvent(data);
                break;
                
            case 'analytics:report':
                result = await worker.generateReport(data);
                break;
                
            case 'worker:stats':
                result = worker.getStats();
                break;
                
            case 'worker:shutdown':
                await worker.shutdown();
                result = { status: 'SHUTDOWN_COMPLETE' };
                break;
                
            case 'worker:health':
                result = { status: worker.status };
                break;
                
            default:
                throw new Error(`Unknown type: ${type}`);
        }
        
        parentPort.postMessage({
            type: `${type}:complete`,
            jobId,
            success: true,
            data: result,
            workerId: workerData?.workerId || 'analytics-1'
        });
        
    } catch (error) {
        parentPort.postMessage({
            type: `${type}:error`,
            jobId,
            success: false,
            error: { message: error.message }
        });
    }
});

worker.initialize().catch(error => {
    log(`Fatal: ${error.message}`);
    process.exit(1);
});

// ============================================================
// 📁 events/handlers/alert.handler.js — ALERT HANDLER
// ============================================================
const eventBus = require('../event.bus');

class AlertHandler {
    constructor() {
        this.alerts = [];
        this.registerHandlers();
    }

    registerHandlers() {
        eventBus.registerHandler('detection:complete', (data) => this.handleDetection(data));
        eventBus.registerHandler('execution:complete', (data) => this.handleExecution(data));
        eventBus.registerHandler('problem:critical', (data) => this.handleCritical(data));
    }

    async handleDetection(data) {
        if (data.criticalCount > 0) {
            const alert = {
                id: 'ALT-' + Date.now().toString(36),
                type: 'CRITICAL_DETECTION',
                severity: 'CRITICAL',
                message: `${data.criticalCount} critical problems detected`,
                data,
                timestamp: new Date().toISOString(),
                channels: ['DASHBOARD', 'SLACK', 'EMAIL']
            };
            this.alerts.push(alert);
            await this.sendAlert(alert);
        }
    }

    async handleExecution(data) {
        const alert = {
            id: 'ALT-' + Date.now().toString(36),
            type: 'EXECUTION_COMPLETE',
            severity: 'INFO',
            message: `Execution ${data.id} completed`,
            data,
            timestamp: new Date().toISOString(),
            channels: ['DASHBOARD']
        };
        this.alerts.push(alert);
        await this.sendAlert(alert);
    }

    async handleCritical(data) {
        const alert = {
            id: 'ALT-' + Date.now().toString(36),
            type: 'EMERGENCY',
            severity: 'CRITICAL',
            message: data.message || 'Critical problem detected',
            data,
            timestamp: new Date().toISOString(),
            channels: ['DASHBOARD', 'SLACK', 'EMAIL', 'SMS', 'PAGERDUTY']
        };
        this.alerts.push(alert);
        await this.sendAlert(alert);
    }

    async sendAlert(alert) {
        console.log(`📡 [ALERT] ${alert.severity}: ${alert.message}`);
        console.log(`   Channels: ${alert.channels.join(', ')}`);
        return alert;
    }

    getAlerts(limit = 20) {
        return this.alerts.slice(-limit);
    }
}

module.exports = new AlertHandler();

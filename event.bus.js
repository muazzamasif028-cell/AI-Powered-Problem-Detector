// ============================================================
// 📁 events/event.bus.js — EVENT BUS
// ============================================================
const EventEmitter = require('events');

class EventBus extends EventEmitter {
    constructor() {
        super();
        this.eventHistory = [];
        this.maxHistory = 10000;
        this.handlers = new Map();
    }

    emit(event, data) {
        this.eventHistory.push({
            event,
            data,
            timestamp: new Date().toISOString()
        });

        if (this.eventHistory.length > this.maxHistory) {
            this.eventHistory.shift();
        }

        return super.emit(event, data);
    }

    registerHandler(event, handler) {
        this.on(event, handler);
        console.log(`📡 [EVENT BUS] Handler registered: ${event}`);
    }

    getHistory(event = null, limit = 50) {
        let history = this.eventHistory;
        if (event) {
            history = history.filter(h => h.event === event);
        }
        return history.slice(-limit);
    }
}

module.exports = new EventBus();

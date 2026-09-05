'use strict';

class TelemetryMetrics {
    constructor() {
        this.startedAt = Date.now();

        this.counters = {
            ingested: 0,
            rejected: 0,
            anomalies: 0,
            persisted: 0,
            published: 0
        };

        this.lastEventAt = null;
    }

    increment(name) {
        if (
            Object.prototype.hasOwnProperty.call(
                this.counters,
                name
            )
        ) {
            this.counters[name]++;
        }
    }

    recordEvent(timestamp) {
        this.lastEventAt = timestamp;
    }

    snapshot() {
        return {
            ...this.counters,
            uptimeSeconds:
                Math.floor(
                    (Date.now() - this.startedAt) / 1000
                ),
            lastEventAt: this.lastEventAt
        };
    }
}

module.exports = new TelemetryMetrics();

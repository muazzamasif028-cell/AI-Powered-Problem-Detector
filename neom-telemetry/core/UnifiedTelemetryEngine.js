'use strict';

const PerformanceCollector =
    require('../agent/collectors/PerformanceCollector');

const NetworkCollector =
    require('../agent/collectors/NetworkCollector');

const QueryCollector =
    require('../agent/collectors/QueryCollector');

class UnifiedTelemetryEngine {
    constructor() {
        this.collectors = {
            performance:
                new PerformanceCollector(),

            network:
                new NetworkCollector(),

            query:
                new QueryCollector()
        };
    }

    collectSystemTelemetry() {
        return {
            performance:
                this.collectors.performance.collect(),

            network:
                this.collectors.network.collect(),

            query:
                this.collectors.query.collect(),

            timestamp:
                new Date().toISOString()
        };
    }
}

module.exports = new UnifiedTelemetryEngine();

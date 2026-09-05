'use strict';

const os = require('os');

class PerformanceCollector {
    constructor() {
        this.name = 'performance';
        this.startedAt = Date.now();
    }

    collect() {
        const memory = process.memoryUsage();

        return {
            timestamp: new Date().toISOString(),
            uptimeSeconds: process.uptime(),
            cpu: {
                loadAverage: os.loadavg(),
                cores: os.cpus().length
            },
            memory: {
                rss: memory.rss,
                heapTotal: memory.heapTotal,
                heapUsed: memory.heapUsed,
                external: memory.external
            }
        };
    }
}

module.exports = PerformanceCollector;

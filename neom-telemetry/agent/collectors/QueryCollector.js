'use strict';

class QueryCollector {
    constructor() {
        this.name = 'query';
        this.counters = {
            total: 0,
            successful: 0,
            failed: 0
        };
    }

    recordSuccess() {
        this.counters.total++;
        this.counters.successful++;
    }

    recordFailure() {
        this.counters.total++;
        this.counters.failed++;
    }

    collect() {
        return {
            timestamp: new Date().toISOString(),
            ...this.counters
        };
    }
}

module.exports = QueryCollector;

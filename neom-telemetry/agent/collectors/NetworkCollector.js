'use strict';

const os = require('os');

class NetworkCollector {
    constructor() {
        this.name = 'network';
    }

    collect() {
        const interfaces = os.networkInterfaces();
        const result = {};

        for (const [name, addresses] of Object.entries(interfaces)) {
            result[name] = (addresses || []).map(address => ({
                family: address.family,
                internal: address.internal,
                address: address.address
            }));
        }

        return {
            timestamp: new Date().toISOString(),
            interfaces: result
        };
    }
}

module.exports = NetworkCollector;

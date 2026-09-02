'use strict';

const registry = require('./registry');

function getIntegrationHealth() {
    const modules = registry.list();

    const enabled = modules.filter((module) => module.enabled);

    return {
        status: 'HEALTHY',
        modules: {
            total: modules.length,
            enabled: enabled.length,
            disabled: modules.length - enabled.length
        },
        timestamp: new Date().toISOString()
    };
}

module.exports = {
    getIntegrationHealth
};

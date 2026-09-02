'use strict';

const registry = require('./registry');
const detector = require('../problem-detector');

function registerCoreModules() {
    if (!registry.has('problem-detector')) {
        registry.register('problem-detector', detector, {
            version: '1.0.0',
            category: 'ai-detection',
            dependencies: []
        });
    }

    return registry.list();
}

module.exports = {
    registerCoreModules
};

'use strict';

const registry = require('./registry');

function loadModule(name, modulePath, metadata = {}) {
    if (registry.has(name)) {
        return registry.get(name);
    }

    const loadedModule = require(modulePath);

    registry.register(name, loadedModule, metadata);

    return loadedModule;
}

module.exports = {
    loadModule
};

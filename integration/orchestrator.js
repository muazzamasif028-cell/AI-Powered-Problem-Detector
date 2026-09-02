'use strict';

const registry = require('./registry');

class IntegrationOrchestrator {
    constructor() {
        this.started = false;
    }

    start() {
        if (this.started) {
            return;
        }

        for (const entry of registry.list()) {
            if (!entry.enabled) {
                continue;
            }

            const module = registry.get(entry.name);

            if (module && typeof module.initialize === 'function') {
                module.initialize();
            }
        }

        this.started = true;
    }

    stop() {
        if (!this.started) {
            return;
        }

        const modules = registry.list().reverse();

        for (const entry of modules) {
            const module = registry.get(entry.name);

            if (module && typeof module.shutdown === 'function') {
                module.shutdown();
            }
        }

        this.started = false;
    }

    status() {
        return {
            started: this.started,
            registeredModules: registry.count()
        };
    }
}

module.exports = new IntegrationOrchestrator();

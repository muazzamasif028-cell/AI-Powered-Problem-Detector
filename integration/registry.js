'use strict';

/**
 * SUPREME Integration Registry
 *
 * Central registry for executable modules.
 * Modules register themselves here instead of importing
 * each other directly.
 */

class IntegrationRegistry {
    constructor() {
        this.modules = new Map();
    }

    register(name, module, metadata = {}) {
        if (!name || typeof name !== 'string') {
            throw new TypeError('Module name must be a non-empty string');
        }

        if (!module) {
            throw new TypeError(`Module "${name}" cannot be empty`);
        }

        if (this.modules.has(name)) {
            throw new Error(`Module "${name}" is already registered`);
        }

        this.modules.set(name, {
            name,
            module,
            metadata: {
                version: metadata.version || '1.0.0',
                category: metadata.category || 'core',
                dependencies: Array.isArray(metadata.dependencies)
                    ? metadata.dependencies
                    : [],
                enabled: metadata.enabled !== false
            }
        });

        return this.get(name);
    }

    unregister(name) {
        return this.modules.delete(name);
    }

    has(name) {
        return this.modules.has(name);
    }

    get(name) {
        const entry = this.modules.get(name);
        return entry ? entry.module : undefined;
    }

    getEntry(name) {
        return this.modules.get(name);
    }

    list() {
        return Array.from(this.modules.values()).map((entry) => ({
            name: entry.name,
            ...entry.metadata
        }));
    }

    count() {
        return this.modules.size;
    }

    clear() {
        this.modules.clear();
    }
}

module.exports = new IntegrationRegistry();

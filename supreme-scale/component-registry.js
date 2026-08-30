'use strict';

class ComponentRegistry {
    constructor(maxCapacity) {
        this.maxCapacity = BigInt(maxCapacity);
        this.components = new Map();
        this.totalRegistered = 0n;
    }

    register(id, metadata = {}) {
        if (this.totalRegistered >= this.maxCapacity) {
            throw new Error('COMPONENT_CAPACITY_REACHED');
        }

        if (this.components.has(id)) {
            throw new Error(`COMPONENT_ALREADY_EXISTS: ${id}`);
        }

        const component = {
            id,
            metadata,
            createdAt: new Date().toISOString()
        };

        this.components.set(id, component);
        this.totalRegistered += 1n;

        return component;
    }

    get(id) {
        return this.components.get(id) || null;
    }

    status() {
        return {
            capacity: this.maxCapacity.toString(),
            registered: this.totalRegistered.toString(),
            activeInMemory: this.components.size
        };
    }
}

module.exports = ComponentRegistry;

'use strict';

class BackendComponentFabric {

    constructor(capacity) {
        this.capacity = BigInt(capacity);

        this.components = new Map();

        this.totalCreated = 0n;
    }

    create(id, metadata = {}) {

        if (this.totalCreated >= this.capacity) {
            throw new Error('BACKEND_COMPONENT_CAPACITY_REACHED');
        }

        if (this.components.has(id)) {
            throw new Error(`BACKEND_COMPONENT_EXISTS: ${id}`);
        }

        const component = {
            id,
            metadata,
            createdAt: new Date().toISOString(),
            status: 'ACTIVE'
        };

        this.components.set(id, component);

        this.totalCreated++;

        return component;
    }

    status() {

        return {
            capacity: this.capacity.toString(),
            totalCreated: this.totalCreated.toString(),
            activeInMemory: this.components.size
        };

    }

}

module.exports = BackendComponentFabric;

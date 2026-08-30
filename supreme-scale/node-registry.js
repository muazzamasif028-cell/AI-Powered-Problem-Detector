'use strict';

class NodeRegistry {
    constructor(maxCapacity) {
        this.maxCapacity = BigInt(maxCapacity);
        this.nodes = new Map();
        this.totalRegistered = 0n;
    }

    register(id, metadata = {}) {
        if (this.totalRegistered >= this.maxCapacity) {
            throw new Error('NODE_CAPACITY_REACHED');
        }

        if (this.nodes.has(id)) {
            throw new Error(`NODE_ALREADY_EXISTS: ${id}`);
        }

        const node = {
            id,
            metadata,
            createdAt: new Date().toISOString()
        };

        this.nodes.set(id, node);
        this.totalRegistered += 1n;

        return node;
    }

    get(id) {
        return this.nodes.get(id) || null;
    }

    status() {
        return {
            capacity: this.maxCapacity.toString(),
            registered: this.totalRegistered.toString(),
            activeInMemory: this.nodes.size
        };
    }
}

module.exports = NodeRegistry;

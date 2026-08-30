'use strict';

class LayerRegistry {
    constructor(maxCapacity) {
        this.maxCapacity = BigInt(maxCapacity);
        this.layers = new Map();
        this.totalRegistered = 0n;
    }

    register(id, metadata = {}) {
        if (this.totalRegistered >= this.maxCapacity) {
            throw new Error('LAYER_CAPACITY_REACHED');
        }

        if (this.layers.has(id)) {
            throw new Error(`LAYER_ALREADY_EXISTS: ${id}`);
        }

        const layer = {
            id,
            metadata,
            createdAt: new Date().toISOString()
        };

        this.layers.set(id, layer);
        this.totalRegistered += 1n;

        return layer;
    }

    get(id) {
        return this.layers.get(id) || null;
    }

    status() {
        return {
            capacity: this.maxCapacity.toString(),
            registered: this.totalRegistered.toString(),
            activeInMemory: this.layers.size
        };
    }
}

module.exports = LayerRegistry;

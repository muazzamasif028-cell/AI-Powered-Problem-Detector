'use strict';

/**
 * SUPREME BACKEND LAYER FABRIC
 *
 * Logical layer-capacity manager.
 * Does not allocate billions of objects in memory.
 */

class BackendLayerFabric {

    constructor(capacity) {
        this.capacity = BigInt(capacity);
        this.registered = 0n;
        this.activeInMemory = 0;
    }

    register(layer) {

        if (this.registered >= this.capacity) {
            throw new Error('Backend layer capacity reached');
        }

        if (!layer) {
            throw new TypeError('Backend layer is required');
        }

        this.registered += 1n;
        this.activeInMemory += 1;

        return {
            id: `BACKEND-LAYER-${this.registered}`,
            layer
        };
    }

    release() {

        if (this.activeInMemory > 0) {
            this.activeInMemory -= 1;
        }
    }

    status() {

        return {
            capacity: this.capacity.toString(),
            registered: this.registered.toString(),
            activeInMemory: this.activeInMemory
        };
    }
}

module.exports = BackendLayerFabric;

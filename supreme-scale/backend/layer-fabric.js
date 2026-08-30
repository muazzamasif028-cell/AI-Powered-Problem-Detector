'use strict';

class BackendLayerFabric {

    constructor(capacity) {
        this.capacity = BigInt(capacity);

        this.activeLayers = new Map();

        this.totalCreated = 0n;
    }

    create(id, metadata = {}) {

        if (this.totalCreated >= this.capacity) {
            throw new Error('BACKEND_LAYER_CAPACITY_REACHED');
        }

        if (this.activeLayers.has(id)) {
            throw new Error(`BACKEND_LAYER_EXISTS: ${id}`);
        }

        const layer = {
            id,
            metadata,
            createdAt: new Date().toISOString(),
            status: 'ACTIVE'
        };

        this.activeLayers.set(id, layer);

        this.totalCreated++;

        return layer;
    }

    status() {

        return {
            capacity: this.capacity.toString(),
            totalCreated: this.totalCreated.toString(),
            activeInMemory: this.activeLayers.size
        };

    }

}

module.exports = BackendLayerFabric;'use strict';

class BackendLayerFabric {

    constructor(capacity) {
        this.capacity = BigInt(capacity);

        this.activeLayers = new Map();

        this.totalCreated = 0n;
    }

    create(id, metadata = {}) {

        if (this.totalCreated >= this.capacity) {
            throw new Error('BACKEND_LAYER_CAPACITY_REACHED');
        }

        if (this.activeLayers.has(id)) {
            throw new Error(`BACKEND_LAYER_EXISTS: ${id}`);
        }

        const layer = {
            id,
            metadata,
            createdAt: new Date().toISOString(),
            status: 'ACTIVE'
        };

        this.activeLayers.set(id, layer);

        this.totalCreated++;

        return layer;
    }

    status() {

        return {
            capacity: this.capacity.toString(),
            totalCreated: this.totalCreated.toString(),
            activeInMemory: this.activeLayers.size
        };

    }

}

module.exports = BackendLayerFabric;


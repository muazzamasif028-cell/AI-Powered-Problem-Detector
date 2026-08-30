'use strict';

class BackendNodeFabric {

    constructor(capacity) {
        this.capacity = BigInt(capacity);

        this.nodes = new Map();

        this.totalCreated = 0n;
    }

    create(id, metadata = {}) {

        if (this.totalCreated >= this.capacity) {
            throw new Error('BACKEND_NODE_CAPACITY_REACHED');
        }

        if (this.nodes.has(id)) {
            throw new Error(`BACKEND_NODE_EXISTS: ${id}`);
        }

        const node = {
            id,
            metadata,
            createdAt: new Date().toISOString(),
            status: 'ACTIVE'
        };

        this.nodes.set(id, node);

        this.totalCreated++;

        return node;
    }

    status() {

        return {
            capacity: this.capacity.toString(),
            totalCreated: this.totalCreated.toString(),
            activeInMemory: this.nodes.size
        };

    }

}

module.exports = BackendNodeFabric;

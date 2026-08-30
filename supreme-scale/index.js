'use strict';

const {
    SUPREME_SCALE,
    serializeScale
} = require('./scale-config');

const ComponentRegistry = require('./component-registry');
const LayerRegistry = require('./layer-registry');
const NodeRegistry = require('./node-registry');

class SupremeScaleRuntime {
    constructor() {
        this.components = new ComponentRegistry(
            SUPREME_SCALE.frontend.components
        );

        this.layers = new LayerRegistry(
            SUPREME_SCALE.frontend.layers
        );

        this.nodes = new NodeRegistry(
            SUPREME_SCALE.frontend.nodes
        );

        this.started = false;
    }

    start() {
        this.started = true;

        console.log('SUPREME Scale Runtime initialized');

        return this.status();
    }

    stop() {
        this.started = false;

        console.log('SUPREME Scale Runtime stopped');
    }

    status() {
        return {
            started: this.started,

            architecture: serializeScale({
                frontend: SUPREME_SCALE.frontend
            }),

            registries: {
                layers: this.layers.status(),
                components: this.components.status(),
                nodes: this.nodes.status()
            },

            compute: serializeScale(SUPREME_SCALE.compute)
        };
    }
}

module.exports = new SupremeScaleRuntime();

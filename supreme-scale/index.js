'use strict';

const {
    SUPREME_SCALE,
    serializeScale
} = require('./scale-config');

const ComponentRegistry = require('./component-registry');
const LayerRegistry = require('./layer-registry');
const NodeRegistry = require('./node-registry');

const backendRuntime = require('./backend');

class SupremeScaleRuntime {
    constructor() {

        // ==============================
        // FRONTEND SCALE
        // ==============================

        this.components = new ComponentRegistry(
            SUPREME_SCALE.frontend.components
        );

        this.layers = new LayerRegistry(
            SUPREME_SCALE.frontend.layers
        );

        this.nodes = new NodeRegistry(
            SUPREME_SCALE.frontend.nodes
        );

        // ==============================
        // BACKEND HYPERSCALE
        // ==============================

        this.backend = backendRuntime;

        this.started = false;
    }

    start() {

        if (this.started) {
            return this.status();
        }

        this.started = true;

        this.backend.start();

        console.log('SUPREME Scale Runtime initialized');
        console.log('Frontend Scale: ONLINE');
        console.log('Backend HyperScale: ONLINE');

        return this.status();
    }

    stop() {

        if (!this.started) {
            return;
        }

        this.backend.stop();

        this.started = false;

        console.log('SUPREME Scale Runtime stopped');
    }

    status() {

        return {
            started: this.started,

            architecture: {
                frontend: serializeScale(
                    SUPREME_SCALE.frontend
                ),

                backend: serializeScale(
                    SUPREME_SCALE.backend
                )
            },

            registries: {
                frontend: {
                    layers: this.layers.status(),
                    components: this.components.status(),
                    nodes: this.nodes.status()
                },

                backend: this.backend.status()
            },

            compute: serializeScale(
                SUPREME_SCALE.compute
            )
        };
    }
}

module.exports = new SupremeScaleRuntime();

'use strict';

const BACKEND_SCALE = require('./backend-scale-config');

const BackendLayerFabric =
    require('./layer-fabric');

const BackendComponentFabric =
    require('./component-fabric');

const BackendNodeFabric =
    require('./node-fabric');


class SupremeBackendRuntime {

    constructor() {

        this.layers =
            new BackendLayerFabric(
                BACKEND_SCALE.layers
            );

        this.components =
            new BackendComponentFabric(
                BACKEND_SCALE.components
            );

        this.nodes =
            new BackendNodeFabric(
                BACKEND_SCALE.nodes
            );

        this.started = false;
    }


    start() {

        this.started = true;

        console.log(
            'SUPREME Backend HyperScale Runtime initialized'
        );

        return this.status();
    }


    stop() {

        this.started = false;

        console.log(
            'SUPREME Backend HyperScale Runtime stopped'
        );
    }


    status() {

        return {

            started: this.started,

            architecture: {

                layers:
                    BACKEND_SCALE.layers.toString(),

                components:
                    BACKEND_SCALE.components.toString(),

                nodes:
                    BACKEND_SCALE.nodes.toString()

            },

            runtime: {

                layers:
                    this.layers.status(),

                components:
                    this.components.status(),

                nodes:
                    this.nodes.status()

            },

            compute:
                BACKEND_SCALE.compute

        };

    }

}


module.exports =
    new SupremeBackendRuntime();

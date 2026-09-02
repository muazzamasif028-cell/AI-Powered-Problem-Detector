'use strict';

/**
 * SUPREME SCALE CONFIGURATION
 *
 * Logical capacity targets.
 * These values represent addressable architecture capacity,
 * not simultaneously allocated JavaScript objects.
 */

const SUPREME_SCALE = Object.freeze({

    version: '2.0.0',

    architecture: Object.freeze({
        layers: 177_000_000_000_000n,
        components: 15_000_000_000_000_000n,
        nodes: 75_000_000_000_000_000n
    }),

    frontend: {
        layers: 177_000_000_000_000n,
        components: 15_000_000_000_000_000n,
        nodes: 75_000_000_000_000_000n
    },

    backend: {
        layers: 177_000_000_000_000n,
        components: 15_000_000_000_000_000n,
        nodes: 75_000_000_000_000_000n
    },

    compute: {
        cpu: {
            enabled: true,
            role: 'control-plane'
        },

        gpu: {
            enabled: true,
            role: 'parallel-compute'
        },

        tpu: {
            enabled: true,
            role: 'ai-acceleration'
        },

        mpu: {
            enabled: true,
            role: 'processing-orchestration'
        }
    }

});

function serializeScale(scale) {
    return JSON.parse(
        JSON.stringify(
            scale,
            (_, value) =>
                typeof value === 'bigint'
                    ? value.toString()
                    : value
        )
    );
}

module.exports = {
    SUPREME_SCALE,
    serializeScale
};

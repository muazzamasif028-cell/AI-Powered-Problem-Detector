'use strict';

/**
 * SUPREME SCALE CONFIGURATION
 *
 * Logical capacity targets for the platform.
 * These values represent addressable architecture capacity,
 * not simultaneously allocated JavaScript objects.
 */

const SUPREME_SCALE = Object.freeze({
    version: '1.0.0',

    frontend: {
        layers: 6_000_000_000n,
        components: 500_000_000_000n,
        nodes: 2_500_000_000_000n
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
        JSON.stringify(scale, (_, value) =>
            typeof value === 'bigint' ? value.toString() : value
        )
    );
}

module.exports = {
    SUPREME_SCALE,
    serializeScale
};




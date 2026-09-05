'use strict';

class RedisStateStore {
    constructor() {
        this.enabled =
            String(
                process.env.NEOM_TELEMETRY_REDIS || 'false'
            ).toLowerCase() === 'true';

        this.client = null;
    }

    async connect() {
        if (!this.enabled) {
            return false;
        }

        const { createClient } = require('redis');

        if (!this.client) {
            this.client = createClient({
                url:
                    process.env.REDIS_URL ||
                    'redis://localhost:6379'
            });

            this.client.on(
                'error',
                error => console.error(
                    '[NEOM REDIS]',
                    error.message
                )
            );
        }

        if (!this.client.isOpen) {
            await this.client.connect();
        }

        return true;
    }

    async setAssetState(event) {
        if (!this.enabled) {
            return false;
        }

        await this.connect();

        await this.client.set(
            `neom:asset:${event.assetId}`,
            JSON.stringify(event),
            { EX: Number(process.env.NEOM_TELEMETRY_REDIS_TTL || 3600) }
        );

        return true;
    }

    async getAssetState(assetId) {
        if (!this.enabled) {
            return null;
        }

        await this.connect();

        const value =
            await this.client.get(
                `neom:asset:${assetId}`
            );

        return value ? JSON.parse(value) : null;
    }
}

module.exports = new RedisStateStore();

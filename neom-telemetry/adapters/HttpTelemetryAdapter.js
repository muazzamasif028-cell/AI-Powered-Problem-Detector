'use strict';

class HttpTelemetryAdapter {
    constructor({
        endpoint = process.env.NEOM_TELEMETRY_ENDPOINT,
        token = process.env.NEOM_TELEMETRY_TOKEN,
        intervalMs = Number(process.env.NEOM_TELEMETRY_POLL_MS || 5000)
    } = {}) {
        this.endpoint = endpoint;
        this.token = token;
        this.intervalMs = intervalMs;
        this.timer = null;
    }

    async fetchOnce(onTelemetry) {
        if (!this.endpoint) {
            throw new Error(
                'NEOM_TELEMETRY_ENDPOINT is not configured.'
            );
        }

        const response = await fetch(
            this.endpoint,
            {
                headers: this.token
                    ? { Authorization: `Bearer ${this.token}` }
                    : {}
            }
        );

        if (!response.ok) {
            throw new Error(
                `Telemetry endpoint returned HTTP ${response.status}`
            );
        }

        const payload = await response.json();

        if (Array.isArray(payload)) {
            for (const item of payload) {
                await onTelemetry(item);
            }
            return payload.length;
        }

        await onTelemetry(payload);
        return 1;
    }

    start(onTelemetry) {
        const run = async () => {
            try {
                await this.fetchOnce(onTelemetry);
            } catch (error) {
                console.error(
                    '[NEOM HTTP TELEMETRY]',
                    error.message
                );
            }
        };

        run();
        this.timer = setInterval(run, this.intervalMs);
    }

    stop() {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
    }
}

module.exports = HttpTelemetryAdapter;

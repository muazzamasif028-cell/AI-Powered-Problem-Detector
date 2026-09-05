'use strict';

class SimulationTelemetryAdapter {
    constructor(intervalMs = 5000) {
        this.intervalMs = intervalMs;
        this.timer = null;
        this.onTelemetry = null;
    }

    start(onTelemetry) {
        this.onTelemetry = onTelemetry;

        this.timer = setInterval(() => {
            const temperatureC =
                Number((25 + Math.random() * 30).toFixed(2));

            const powerKw =
                Number((500 + Math.random() * 1500).toFixed(2));

            const failureProbability =
                Number((Math.random() * 0.15).toFixed(3));

            onTelemetry({
                domain: 'ENERGY',
                zone: ['THE LINE', 'OXAGON', 'TROJENA', 'SINDALAH'][
                    Math.floor(Math.random() * 4)
                ],
                assetId: 'SIM-ENERGY-' +
                    String(Math.floor(Math.random() * 10) + 1).padStart(2, '0'),
                source: 'SIMULATION',
                metrics: {
                    temperatureC,
                    powerKw,
                    failureProbability
                },
                metadata: {
                    simulation: true
                }
            });
        }, this.intervalMs);
    }

    stop() {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
    }
}

module.exports = SimulationTelemetryAdapter;

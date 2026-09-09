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

            const solarPowerKw =
                Number((200 + Math.random() * 800).toFixed(2));

            const solarEfficiencyPercent =
                Number((85 + Math.random() * 12).toFixed(2));

            const windPowerKw =
                Number((150 + Math.random() * 650).toFixed(2));

            const windSpeedMps =
                Number((4 + Math.random() * 16).toFixed(2));

            const renewablePowerKw =
                Number((solarPowerKw + windPowerKw).toFixed(2));

            const renewableSharePercent =
                Number(
                    Math.min(
                        100,
                        (renewablePowerKw / Math.max(powerKw, 1)) * 100
                    ).toFixed(2)
                );

            const batterySocPercent =
                Number((55 + Math.random() * 40).toFixed(2));

            const batteryPowerKw =
                Number((-300 + Math.random() * 600).toFixed(2));

            const hydrogenProductionKgH =
                Number((120 + Math.random() * 80).toFixed(2));

            const pressureBar =
                Number((25 + Math.random() * 20).toFixed(2));

            const equipmentHealthPercent =
                Number((85 + Math.random() * 14).toFixed(2));

            const buildingOccupancyPercent =
                Number((20 + Math.random() * 70).toFixed(2));

            const structuralHealthPercent =
                Number((85 + Math.random() * 14).toFixed(2));

            const constructionProgressPercent =
                Number((10 + Math.random() * 85).toFixed(2));

            const waterLeakProbability =
                Number((Math.random() * 0.2).toFixed(3));

            const sensorHealthPercent =
                Number((85 + Math.random() * 14).toFixed(2));

            // SAFETY METRICS
            const fireDetectionProbability =
                Number((Math.random() * 0.12).toFixed(3));

            const smokeLevelPpm =
                Number((Math.random() * 80).toFixed(2));

            const hydrogenLeakProbability =
                Number((Math.random() * 0.10).toFixed(3));

            const hydrogenLeakRate =
                Number((Math.random() * 5).toFixed(3));

            const securityBreachProbability =
                Number((Math.random() * 0.08).toFixed(3));

            const unauthorizedAccessCount =
                Math.floor(Math.random() * 4);

            const droneFleetLostProbability =
                Number((Math.random() * 0.06).toFixed(3));

            const dronesOnline =
                Math.floor(8 + Math.random() * 5);

            const dronesLost =
                Math.floor(Math.random() * 3);

            const craneFailureProbability =
                Number((Math.random() * 0.08).toFixed(3));

            const craneLoadPercent =
                Number((20 + Math.random() * 75).toFixed(2));

            // MOBILITY METRICS
            const vehicleSpeedKph =
                Number((20 + Math.random() * 140).toFixed(2));

            const vehicleBatteryPercent =
                Number((15 + Math.random() * 80).toFixed(2));

            const vehicleHealthPercent =
                Number((80 + Math.random() * 19).toFixed(2));

            const trafficDensityPercent =
                Number((10 + Math.random() * 85).toFixed(2));

            const collisionRiskProbability =
                Number((Math.random() * 0.3).toFixed(3));

            const gpsAccuracyMeters =
                Number((1 + Math.random() * 15).toFixed(2));

            onTelemetry({
                domain: [
                    'ENERGY',
                    'HYDROGEN',
                    'INFRASTRUCTURE',
                    'MOBILITY',
                    'SAFETY'
                ][Math.floor(Math.random() * 5)],
                zone: ['THE LINE', 'OXAGON', 'TROJENA', 'SINDALAH'][
                    Math.floor(Math.random() * 4)
                ],
                assetId: 'SIM-ENERGY-' +
                    String(Math.floor(Math.random() * 10) + 1).padStart(2, '0'),
                source: 'SIMULATION',
                metrics: {
                    temperatureC,
                    powerKw,
                    failureProbability,
                    solarPowerKw,
                    solarEfficiencyPercent,
                    windPowerKw,
                    windSpeedMps,
                    renewablePowerKw,
                    renewableSharePercent,
                    batterySocPercent,
                    batteryPowerKw,
                    hydrogenProductionKgH,
                    pressureBar,
                    equipmentHealthPercent,
                    buildingOccupancyPercent,
                    structuralHealthPercent,
                    constructionProgressPercent,
                    waterLeakProbability,
                    sensorHealthPercent,
                    vehicleSpeedKph,
                    vehicleBatteryPercent,
                    vehicleHealthPercent,
                    trafficDensityPercent,
                    collisionRiskProbability,
                    gpsAccuracyMeters,
                    fireDetectionProbability,
                    smokeLevelPpm,
                    hydrogenLeakProbability,
                    hydrogenLeakRate,
                    securityBreachProbability,
                    unauthorizedAccessCount,
                    droneFleetLostProbability,
                    dronesOnline,
                    dronesLost,
                    craneFailureProbability,
                    craneLoadPercent
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

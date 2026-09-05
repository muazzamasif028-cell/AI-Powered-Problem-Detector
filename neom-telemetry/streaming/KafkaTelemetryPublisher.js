'use strict';

class KafkaTelemetryPublisher {
    constructor() {
        this.enabled =
            String(
                process.env.NEOM_TELEMETRY_KAFKA || 'false'
            ).toLowerCase() === 'true';

        this.kafka = null;
        this.producer = null;
        this.connected = false;
    }

    async connect() {
        if (!this.enabled || this.connected) {
            return false;
        }

        const { Kafka } = require('kafkajs');

        this.kafka = new Kafka({
            clientId:
                process.env.SERVICE_NAME ||
                'supreme-neom-telemetry',

            brokers:
                (
                    process.env.KAFKA_BROKERS ||
                    'localhost:9092'
                ).split(',')
        });

        this.producer =
            this.kafka.producer();

        await this.producer.connect();

        this.connected = true;

        return true;
    }

    async publish(event) {
        if (!this.enabled) {
            return false;
        }

        await this.connect();

        await this.producer.send({
            topic:
                process.env.NEOM_KAFKA_TOPIC ||
                'neom.telemetry',

            messages: [
                {
                    key: event.assetId,
                    value: JSON.stringify(event),
                    headers: {
                        'event-type': 'NEOM_TELEMETRY'
                    }
                }
            ]
        });

        return true;
    }

    async disconnect() {
        if (this.producer && this.connected) {
            await this.producer.disconnect();
        }

        this.connected = false;
    }
}

module.exports = new KafkaTelemetryPublisher();

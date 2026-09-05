'use strict';

class MongoTelemetryStore {
    constructor() {
        this.enabled =
            String(
                process.env.NEOM_TELEMETRY_MONGODB || 'false'
            ).toLowerCase() === 'true';

        this.model = null;
    }

    async connect() {
        if (!this.enabled) {
            return false;
        }

        const mongoose = require('mongoose');

        if (mongoose.connection.readyState !== 1) {
            await mongoose.connect(
                process.env.MONGODB_URI ||
                'mongodb://localhost:27017/supreme-platform',
                {
                    maxPoolSize: 20,
                    serverSelectionTimeoutMS: 5000,
                    socketTimeoutMS: 45000
                }
            );
        }

        if (!this.model) {
            const schema =
                new mongoose.Schema(
                    {
                        telemetryId: {
                            type: String,
                            required: true,
                            unique: true
                        },
                        organization: String,
                        domain: String,
                        zone: String,
                        assetId: String,
                        source: String,
                        metrics: mongoose.Schema.Types.Mixed,
                        metadata: mongoose.Schema.Types.Mixed,
                        timestamp: Date
                    },
                    {
                        collection: 'neom_telemetry',
                        timestamps: true
                    }
                );

            this.model =
                mongoose.models.NeomTelemetry ||
                mongoose.model('NeomTelemetry', schema);

            await this.model.collection.createIndex({
                zone: 1,
                assetId: 1,
                timestamp: -1
            });
        }

        return true;
    }

    async save(event) {
        if (!this.enabled) {
            return false;
        }

        await this.connect();
        await this.model.create({
            ...event,
            timestamp: new Date(event.timestamp)
        });

        return true;
    }
}

module.exports = new MongoTelemetryStore();

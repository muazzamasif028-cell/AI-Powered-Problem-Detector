'use strict';

const crypto = require('crypto');
const eventBus = require('../event.bus');

const { verifyToken } =
    require('../security/auth/jwt-auth');

const { hasPermission } =
    require('../security/rbac/permissions');

const MongoTelemetryStore =
    require('./persistence/MongoTelemetryStore');

const RedisStateStore =
    require('./realtime/RedisStateStore');

const KafkaTelemetryPublisher =
    require('./streaming/KafkaTelemetryPublisher');

const telemetryMetrics =
    require('./observability/TelemetryMetrics');

const unifiedEngine =
    require('./core/UnifiedTelemetryEngine');

const SimulationTelemetryAdapter =
    require('./adapters/SimulationTelemetryAdapter');

const HttpTelemetryAdapter =
    require('./adapters/HttpTelemetryAdapter');

const ALLOWED_DOMAINS = new Set([
    'ENERGY',
    'HYDROGEN',
    'INFRASTRUCTURE',
    'MOBILITY',
    'SAFETY'
]);

const ALLOWED_ZONES = new Set([
    'THE LINE',
    'OXAGON',
    'TROJENA',
    'SINDALAH'
]);

const MAX_HISTORY = 5000;
const MAX_METRICS = 100;

class NeomRealtimeTelemetry {

    constructor() {
        this.history = [];
        this.io = null;
        this.startedAt = new Date().toISOString();
        this.adapters = new Set();
        this.ingestionStarted = false;

        eventBus.on(
            'NEOM_TELEMETRY_INGESTED',
            event => this.forwardEvent(event)
        );
    }

    normalize(input = {}, auth = {}) {
        if (
            !input ||
            typeof input !== 'object' ||
            Array.isArray(input)
        ) {
            throw new TypeError(
                'Telemetry payload must be an object.'
            );
        }

        const domain =
            String(input.domain || '')
                .trim()
                .toUpperCase();

        const zone =
            String(input.zone || '')
                .trim()
                .toUpperCase();

        const assetId =
            String(input.assetId || '')
                .trim();

        if (!ALLOWED_DOMAINS.has(domain)) {
            throw new TypeError(
                'Invalid telemetry domain.'
            );
        }

        if (!ALLOWED_ZONES.has(zone)) {
            throw new TypeError(
                'Invalid NEOM zone.'
            );
        }

        if (!assetId) {
            throw new TypeError(
                'assetId is required.'
            );
        }

        const metrics =
            input.metrics &&
            typeof input.metrics === 'object' &&
            !Array.isArray(input.metrics)
                ? input.metrics
                : {};

        if (
            Object.keys(metrics).length >
            MAX_METRICS
        ) {
            throw new TypeError(
                `Maximum telemetry metrics is ${MAX_METRICS}.`
            );
        }

        return {
            telemetryId:
                crypto.randomUUID(),

            organization:
                String(
                    auth.organization ||
                    input.organization ||
                    'NEOM'
                )
                .trim()
                .toUpperCase(),

            domain,
            zone,
            assetId,

            source:
                String(
                    input.source ||
                    'EDGE'
                )
                .trim()
                .toUpperCase(),

            metrics,

            metadata:
                input.metadata &&
                typeof input.metadata === 'object' &&
                !Array.isArray(input.metadata)
                    ? input.metadata
                    : {},

            timestamp:
                new Date().toISOString()
        };
    }

    async ingest(
        input,
        auth = {}
    ) {
        const event =
            this.normalize(
                input,
                auth
            );

        this.history.push(event);

        if (this.history.length > MAX_HISTORY) {
            this.history.shift();
        }

        telemetryMetrics.increment('ingested');
        telemetryMetrics.recordEvent(event.timestamp);

        const anomaly =
            this.detectAnomaly(event);

        if (anomaly) {
            event.anomaly = anomaly;
            telemetryMetrics.increment('anomalies');

            eventBus.emit(
                'NEOM_TELEMETRY_ANOMALY',
                {
                    telemetry: event,
                    anomaly
                }
            );
        }

        eventBus.emit(
            'NEOM_TELEMETRY_INGESTED',
            event
        );

        await Promise.allSettled([
            this.persist(event),
            this.updateLiveState(event),
            this.publish(event)
        ]);

        return event;
    }

    detectAnomaly(event) {
        const metrics = event.metrics || {};

        if (
            Number.isFinite(metrics.temperatureC) &&
            metrics.temperatureC >= 80
        ) {
            return {
                type: 'HIGH_TEMPERATURE',
                severity: 'HIGH',
                threshold: 80,
                value: metrics.temperatureC
            };
        }

        if (
            Number.isFinite(metrics.failureProbability) &&
            metrics.failureProbability >= 0.7
        ) {
            return {
                type: 'PREDICTED_FAILURE',
                severity: 'CRITICAL',
                threshold: 0.7,
                value: metrics.failureProbability
            };
        }

        return null;
    }

    async persist(event) {
        try {
            if (await MongoTelemetryStore.save(event)) {
                telemetryMetrics.increment('persisted');
            }
        } catch (error) {
            console.error(
                '[NEOM MONGO]',
                error.message
            );
        }
    }

    async updateLiveState(event) {
        try {
            await RedisStateStore.setAssetState(event);
        } catch (error) {
            console.error(
                '[NEOM REDIS]',
                error.message
            );
        }
    }

    async publish(event) {
        try {
            if (await KafkaTelemetryPublisher.publish(event)) {
                telemetryMetrics.increment('published');
            }
        } catch (error) {
            console.error(
                '[NEOM KAFKA]',
                error.message
            );
        }
    }

    forwardEvent(event) {
        if (!this.io) {
            return;
        }

        this.io
            .to('neom:all')
            .emit(
                'neom:telemetry',
                event
            );

        this.io
            .to(`neom:zone:${event.zone}`)
            .emit(
                'neom:telemetry',
                event
            );

        this.io
            .to(`neom:asset:${event.assetId}`)
            .emit(
                'neom:telemetry',
                event
            );
    }

    attachSocketServer(io) {
        this.io = io;

        io.use((socket, next) => {
            try {
                const token =
                    socket.handshake?.auth?.token ||
                    (socket.handshake?.headers?.authorization || '')
                        .replace(
                            /^Bearer[[:space:]]+/i,
                            ''
                        );

                if (!token) {
                    return next(
                        new Error(
                            'AUTHENTICATION_REQUIRED'
                        )
                    );
                }

                const payload =
                    verifyToken(token);

                const organization =
                    String(
                        payload.organization || ''
                    )
                    .trim()
                    .toUpperCase();

                const role =
                    String(
                        payload.role || ''
                    )
                    .trim()
                    .toUpperCase();

                if (organization !== 'NEOM') {
                    return next(
                        new Error(
                            'NEOM_ORGANIZATION_REQUIRED'
                        )
                    );
                }

                if (
                    !hasPermission(
                        role,
                        'NEOM_VIEW'
                    )
                ) {
                    return next(
                        new Error(
                            'NEOM_VIEW_PERMISSION_REQUIRED'
                        )
                    );
                }

                socket.auth = {
                    userId: payload.sub,
                    organization,
                    role
                };

                return next();

            } catch (error) {
                return next(
                    new Error(
                        'INVALID_OR_EXPIRED_TOKEN'
                    )
                );
            }
        });

        io.on(
            'connection',
            socket => {
                socket.join('neom:all');

                socket.emit(
                    'neom:telemetry:ready',
                    {
                        status: 'CONNECTED',
                        organization:
                            socket.auth.organization,
                        role:
                            socket.auth.role,
                        timestamp:
                            new Date().toISOString()
                    }
                );

                socket.on(
                    'subscribe',
                    (request = {}) => {
                        const zone =
                            String(
                                request.zone || ''
                            )
                            .trim()
                            .toUpperCase();

                        const assetId =
                            String(
                                request.assetId || ''
                            )
                            .trim();

                        if (
                            zone &&
                            !ALLOWED_ZONES.has(zone)
                        ) {
                            socket.emit(
                                'neom:telemetry:error',
                                {
                                    error:
                                        'INVALID_ZONE'
                                }
                            );

                            return;
                        }

                        if (zone) {
                            socket.join(
                                `neom:zone:${zone}`
                            );
                        }

                        if (assetId) {
                            socket.join(
                                `neom:asset:${assetId}`
                            );
                        }

                        socket.emit(
                            'neom:telemetry:subscribed',
                            {
                                zone:
                                    zone || null,
                                assetId:
                                    assetId || null,
                                timestamp:
                                    new Date().toISOString()
                            }
                        );
                    }
                );

                socket.on(
                    'unsubscribe',
                    (request = {}) => {
                        const zone =
                            String(
                                request.zone || ''
                            )
                            .trim()
                            .toUpperCase();

                        const assetId =
                            String(
                                request.assetId || ''
                            )
                            .trim();

                        if (
                            zone &&
                            ALLOWED_ZONES.has(zone)
                        ) {
                            socket.leave(
                                `neom:zone:${zone}`
                            );
                        }

                        if (assetId) {
                            socket.leave(
                                `neom:asset:${assetId}`
                            );
                        }
                    }
                );
            }
        );
    }

    startAdapters() {
        if (this.ingestionStarted) {
            return;
        }

        this.ingestionStarted = true;

        const adapterMode =
            (
                process.env.NEOM_TELEMETRY_MODE ||
                'SIMULATION'
            )
            .trim()
            .toUpperCase();

        if (adapterMode === 'HTTP') {
            const adapter =
                new HttpTelemetryAdapter();

            adapter.start(
                telemetry =>
                    this.ingest(
                        telemetry,
                        {
                            organization: 'NEOM'
                        }
                    )
                    .catch(
                        error =>
                            console.error(
                                '[NEOM HTTP INGEST]',
                                error.message
                            )
                    )
            );

            this.adapters.add(adapter);

            console.log(
                '📡 NEOM telemetry HTTP adapter started'
            );
        } else {
            const adapter =
                new SimulationTelemetryAdapter();

            adapter.start(
                telemetry =>
                    this.ingest(
                        telemetry,
                        {
                            organization: 'NEOM'
                        }
                    )
                    .catch(
                        error =>
                            console.error(
                                '[NEOM SIMULATION]',
                                error.message
                            )
                    )
            );

            this.adapters.add(adapter);

            console.log(
                '📡 NEOM telemetry SIMULATION adapter started'
            );
        }
    }

    stopAdapters() {
        for (const adapter of this.adapters) {
            if (typeof adapter.stop === 'function') {
                adapter.stop();
            }
        }

        this.adapters.clear();
        this.ingestionStarted = false;
    }

    getHistory({
        zone = null,
        domain = null,
        assetId = null,
        limit = 100
    } = {}) {
        const safeLimit =
            Math.min(
                Math.max(
                    Number(limit) || 100,
                    1
                ),
                500
            );

        let events =
            this.history;

        if (zone) {
            const normalized =
                String(zone)
                    .trim()
                    .toUpperCase();

            events =
                events.filter(
                    event =>
                        event.zone === normalized
                );
        }

        if (domain) {
            const normalized =
                String(domain)
                    .trim()
                    .toUpperCase();

            events =
                events.filter(
                    event =>
                        event.domain === normalized
                );
        }

        if (assetId) {
            events =
                events.filter(
                    event =>
                        event.assetId ===
                        String(assetId).trim()
                );
        }

        return events.slice(-safeLimit);
    }

    status() {
        return {
            status: 'ONLINE',

            transport:
                this.io
                    ? 'SOCKET_IO'
                    : 'API_ONLY',

            ingestion:
                this.ingestionStarted
                    ? 'RUNNING'
                    : 'STOPPED',

            mode:
                (
                    process.env.NEOM_TELEMETRY_MODE ||
                    'SIMULATION'
                ).toUpperCase(),

            eventsInMemory:
                this.history.length,

            maxHistory:
                MAX_HISTORY,

            metrics:
                telemetryMetrics.snapshot(),

            domains:
                Array.from(ALLOWED_DOMAINS),

            zones:
                Array.from(ALLOWED_ZONES),

            timestamp:
                new Date().toISOString()
        };
    }

    systemTelemetry() {
        return unifiedEngine.collectSystemTelemetry();
    }
}

module.exports =
    new NeomRealtimeTelemetry();

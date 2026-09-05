'use strict';

const crypto = require('crypto');
const eventBus = require('../event.bus');

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

        eventBus.on(
            'NEOM_TELEMETRY_INGESTED',
            (event) => this.forwardEvent(event)
        );
    }

    normalize(input = {}, auth = {}) {
        if (!input || typeof input !== 'object' || Array.isArray(input)) {
            throw new TypeError('Telemetry payload must be an object.');
        }

        const domain = String(input.domain || '').trim().toUpperCase();
        const zone = String(input.zone || '').trim().toUpperCase();
        const assetId = String(input.assetId || '').trim();

        if (!ALLOWED_DOMAINS.has(domain)) {
            throw new TypeError(
                'Invalid telemetry domain. Allowed: ENERGY, HYDROGEN, INFRASTRUCTURE, MOBILITY, SAFETY.'
            );
        }

        if (!ALLOWED_ZONES.has(zone)) {
            throw new TypeError(
                'Invalid NEOM zone. Allowed: THE LINE, OXAGON, TROJENA, SINDALAH.'
            );
        }

        if (!assetId) {
            throw new TypeError('assetId is required.');
        }

        const metrics =
            input.metrics &&
            typeof input.metrics === 'object' &&
            !Array.isArray(input.metrics)
                ? input.metrics
                : {};

        const metricKeys = Object.keys(metrics);

        if (metricKeys.length > MAX_METRICS) {
            throw new TypeError(
                `Maximum telemetry metrics is ${MAX_METRICS}.`
            );
        }

        return {
            telemetryId: crypto.randomUUID(),
            organization: String(
                auth.organization || 'NEOM'
            ).toUpperCase(),
            domain,
            zone,
            assetId,
            source: String(
                input.source || 'EDGE'
            ).trim().toUpperCase(),
            metrics,
            metadata:
                input.metadata &&
                typeof input.metadata === 'object' &&
                !Array.isArray(input.metadata)
                    ? input.metadata
                    : {},
            timestamp: new Date().toISOString()
        };
    }

    ingest(input, auth = {}) {
        const event = this.normalize(input, auth);

        this.history.push(event);

        if (this.history.length > MAX_HISTORY) {
            this.history.shift();
        }

        eventBus.emit(
            'NEOM_TELEMETRY_INGESTED',
            event
        );

        return event;
    }

    forwardEvent(event) {
        if (!this.io) {
            return;
        }

        this.io.to('neom:all').emit(
            'neom:telemetry',
            event
        );

        this.io.to(`neom:zone:${event.zone}`).emit(
            'neom:telemetry',
            event
        );

        this.io.to(`neom:asset:${event.assetId}`).emit(
            'neom:telemetry',
            event
        );
    }

    attachSocketServer(io) {
        this.io = io;

        io.on('connection', (socket) => {
            socket.join('neom:all');

            socket.emit(
                'neom:telemetry:ready',
                {
                    status: 'CONNECTED',
                    subscribed: 'ALL',
                    timestamp: new Date().toISOString()
                }
            );

            socket.on('subscribe', (request = {}) => {
                const zone = String(
                    request.zone || ''
                ).trim().toUpperCase();

                const assetId = String(
                    request.assetId || ''
                ).trim();

                if (zone) {
                    if (!ALLOWED_ZONES.has(zone)) {
                        socket.emit(
                            'neom:telemetry:error',
                            {
                                error: 'INVALID_ZONE',
                                zone
                            }
                        );
                        return;
                    }

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
                        zone: zone || null,
                        assetId: assetId || null,
                        timestamp: new Date().toISOString()
                    }
                );
            });

            socket.on('unsubscribe', (request = {}) => {
                const zone = String(
                    request.zone || ''
                ).trim().toUpperCase();

                const assetId = String(
                    request.assetId || ''
                ).trim();

                if (zone && ALLOWED_ZONES.has(zone)) {
                    socket.leave(
                        `neom:zone:${zone}`
                    );
                }

                if (assetId) {
                    socket.leave(
                        `neom:asset:${assetId}`
                    );
                }
            });

            socket.on('disconnect', () => {
                console.log(
                    `📡 [NEOM TELEMETRY] Socket disconnected: ${socket.id}`
                );
            });

            console.log(
                `📡 [NEOM TELEMETRY] Socket connected: ${socket.id}`
            );
        });

        console.log(
            '📡 [NEOM TELEMETRY] Socket.IO gateway attached'
        );
    }

    getHistory({
        zone = null,
        domain = null,
        assetId = null,
        limit = 100
    } = {}) {
        const safeLimit = Math.min(
            Math.max(Number(limit) || 100, 1),
            500
        );

        let events = this.history;

        if (zone) {
            const normalizedZone =
                String(zone).trim().toUpperCase();

            events = events.filter(
                event => event.zone === normalizedZone
            );
        }

        if (domain) {
            const normalizedDomain =
                String(domain).trim().toUpperCase();

            events = events.filter(
                event => event.domain === normalizedDomain
            );
        }

        if (assetId) {
            events = events.filter(
                event => event.assetId === String(assetId).trim()
            );
        }

        return events.slice(-safeLimit);
    }

    status() {
        return {
            status: 'ONLINE',
            transport: this.io ? 'SOCKET_IO' : 'API_ONLY',
            eventsInMemory: this.history.length,
            maxHistory: MAX_HISTORY,
            domains: Array.from(ALLOWED_DOMAINS),
            zones: Array.from(ALLOWED_ZONES),
            startedAt: this.startedAt,
            timestamp: new Date().toISOString()
        };
    }
}

module.exports = new NeomRealtimeTelemetry();

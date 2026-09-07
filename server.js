'use strict';

// ============================================
// SUPREME Platform — Main Server
// ============================================

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const { Server } = require('socket.io');

// ============================================
// Application Modules
// ============================================

const registry = require('./integration/registry');
const orchestrator = require('./integration/orchestrator');

const {
    registerCoreModules
} = require('./integration/register-core');

const supremeScale = require('./supreme-scale');

// ============================================
// NEOM Telemetry
// ============================================

const neomRealtimeTelemetry =
    require('./neom-telemetry/NeomRealtimeTelemetry');

const telemetryMetrics =
    require('./neom-telemetry/observability/TelemetryMetrics');

// ============================================
// Enterprise Security
// ============================================

const enterpriseAccess =
    require('./security/enterprise-access');

const {
    authenticateToken,
    createToken
} = require('./security/auth/jwt-auth');

const {
    PERMISSIONS
} = require('./security/rbac/permissions');

const {
    requirePermission
} = require('./security/rbac/require-permission');

// IMPORTANT:
// Agar tumhare project mein requireOrganization
// kisi different file mein hai to is path ko adjust karna hoga.

const {
    requireOrganization
} = require('./security/organization/require-organization');

// ============================================
// Optional Integration Health
// ============================================

let integrationHealth = null;

try {

    integrationHealth =
        require('./integration/health');

} catch (error) {

    console.warn(
        '[Integration] Health module not available:',
        error.message
    );

}

// ============================================
// Application
// ============================================

const app = express();

const PORT =
    Number(process.env.PORT) || 3000;

let server = null;
let io = null;
let shuttingDown = false;

// ============================================
// Middleware
// ============================================

app.use(helmet());

app.use(cors());

app.use(compression());

app.use(express.json({
    limit: '10mb'
}));

app.use(express.urlencoded({
    extended: true,
    limit: '10mb'
}));

// ============================================
// Core Integration Modules
// ============================================

registerCoreModules();

// ============================================
// Core Server Registration
// ============================================

if (!registry.get('core.server')) {

    registry.register(

        'core.server',

        {

            initialize() {

                console.log(
                    '[Integration] Core server initialized'
                );

            },

            shutdown() {

                console.log(
                    '[Integration] Core server shutdown'
                );

            }

        },

        {

            version: '14.0.0',

            category: 'core'

        }

    );

}

// ============================================
// Helper Functions
// ============================================

function getIntegrationHealth() {

    if (
        integrationHealth &&
        typeof integrationHealth.getIntegrationHealth ===
            'function'
    ) {

        return integrationHealth.getIntegrationHealth();

    }

    return {

        available: false

    };

}

function getScaleStatus() {

    if (
        supremeScale &&
        typeof supremeScale.status === 'function'
    ) {

        return supremeScale.status();

    }

    return {

        started: false

    };

}

// ============================================
// Root Route
// ============================================

app.get('/', (req, res) => {

    return res.json({

        name:
            'SUPREME Platform',

        version:
            '14.0.0',

        status:
            'RUNNING',

        uptime:
            process.uptime(),

        timestamp:
            new Date().toISOString(),

        scale:
            getScaleStatus()

    });

});

// ============================================
// Health Check
// ============================================

app.get('/api/health', (req, res) => {

    const modules =
        registry.list();

    return res.json({

        status:
            'HEALTHY',

        timestamp:
            new Date().toISOString(),

        uptime:
            process.uptime(),

        modules: {

            total:
                modules.length,

            enabled:
                modules.filter(
                    module => module.enabled
                ).length,

            disabled:
                modules.filter(
                    module => !module.enabled
                ).length

        },

        integration:
            getIntegrationHealth(),

        orchestrator:
            orchestrator.status(),

        hyperscale:
            getScaleStatus(),

        neom:
            typeof neomRealtimeTelemetry.status ===
            'function'
                ? neomRealtimeTelemetry.status()
                : {
                    status: 'UNKNOWN'
                }

    });

});

// ============================================
// Dashboard
// ============================================

app.get('/api/dashboard', (req, res) => {

    return res.json({

        dashboard:
            'SUPREME PLATFORM',

        version:
            '14.0.0',

        status:
            'OPERATIONAL',

        modules: [

            'Problem Detector',

            'AI Engine',

            'Payment Gateway',

            'Domain Engine',

            'Satellite Layer',

            'Fleet Management',

            'Security Engine',

            'SUPREME Scale Runtime',

            'Backend HyperScale Runtime',

            'NEOM Real-Time Telemetry',

            'Socket.IO Gateway',

            'Prometheus Metrics'

        ],

        integration: {

            registeredModules:
                registry.count(),

            orchestrator:
                orchestrator.status()

        },

        hyperscale:
            getScaleStatus(),

        revenue: {

            mrr:
                '$1,250',

            arr:
                '$15,000'

        }

    });

});

// ============================================
// Development Authentication
// LOCAL TESTING ONLY
// ============================================

app.post(

    '/api/auth/dev-token',

    (req, res) => {

        if (
            process.env.NODE_ENV ===
            'production'
        ) {

            return res.status(404).json({

                error:
                    'ENDPOINT_NOT_AVAILABLE'

            });

        }

        const {

            userId = 'development-user',

            organization,

            role = 'USER'

        } = req.body || {};

        if (!organization) {

            return res.status(400).json({

                error:
                    'ORGANIZATION_REQUIRED',

                message:
                    'An organization is required.'

            });

        }

        const token =
            createToken({

                userId,

                organization,

                role

            });

        return res.json({

            tokenType:
                'Bearer',

            organization:
                String(organization)
                    .toUpperCase(),

            role,

            expiresIn:
                process.env.JWT_EXPIRES_IN ||
                '1h',

            token

        });

    }

);

// ============================================
// Integration Status
// ============================================

app.get('/api/integration', (req, res) => {

    let manifest;

    try {

        manifest =
            require('./integration/manifest');

    } catch (error) {

        manifest = {

            available: false

        };

    }

    return res.json({

        status:
            'ACTIVE',

        manifest,

        health:
            getIntegrationHealth(),

        orchestrator:
            orchestrator.status(),

        modules:
            registry.list(),

        hyperscale:
            getScaleStatus()

    });

});

// ============================================
// SUPREME Scale Status
// ============================================

app.get('/api/scale', (req, res) => {

    const runtime =
        getScaleStatus();

    return res.json({

        status:
            runtime.started
                ? 'ONLINE'
                : 'OFFLINE',

        runtime,

        timestamp:
            new Date().toISOString()

    });

});

// ============================================
// Problem Detection API
// ============================================

app.post(

    '/api/detect',

    (req, res, next) => {

        try {

            const detector =
                registry.get(
                    'problem-detector'
                );

            if (!detector) {

                return res.status(503).json({

                    error:
                        'DETECTION_SERVICE_UNAVAILABLE'

                });

            }

            const input =
                req.body?.input;

            if (
                typeof input !== 'string' ||
                input.trim().length === 0
            ) {

                return res.status(400).json({

                    error:
                        'DETECTION_INPUT_REQUIRED'

                });

            }

            const result =
                detector.detect(
                    input.trim()
                );

            return res.status(200).json(
                result
            );

        } catch (error) {

            return next(error);

        }

    }

);

// ============================================
// NEOM Command Center
// Enterprise Restricted
// ============================================

app.get(

    '/api/enterprise/neom',

    authenticateToken,

    enterpriseAccess.requireFeature(
        'NEOM_COMMAND_CENTER'
    ),

    requirePermission(
        PERMISSIONS.NEOM_VIEW
    ),

    (req, res) => {

        return res.json({

            organization:
                'NEOM',

            feature:
                'NEOM Command Center',

            status:
                'AUTHORIZED',

            authorizedBy: {

                userId:
                    req.auth?.userId,

                role:
                    req.role,

                permission:
                    req.permission

            },

            systems: [

                'Renewable Energy Management',

                'Green Hydrogen Monitoring',

                'THE LINE Infrastructure',

                'OXAGON Operations',

                'BESS Energy Storage',

                'Carbon Intelligence'

            ],

            timestamp:
                new Date().toISOString()

        });

    }

);

// ============================================
// NEOM Control Operations
// ============================================

app.post(

    '/api/enterprise/neom/control',

    authenticateToken,

    enterpriseAccess.requireFeature(
        'NEOM_COMMAND_CENTER'
    ),

    requirePermission(
        PERMISSIONS.NEOM_CONTROL
    ),

    (req, res) => {

        const {

            system,

            action

        } = req.body || {};

        if (!system || !action) {

            return res.status(400).json({

                error:
                    'CONTROL_PARAMETERS_REQUIRED',

                message:
                    'Both system and action are required.'

            });

        }

        return res.json({

            organization:
                'NEOM',

            status:
                'CONTROL_AUTHORIZED',

            operation: {

                system,

                action

            },

            authorizedBy: {

                userId:
                    req.auth?.userId,

                role:
                    req.role,

                permission:
                    req.permission

            },

            timestamp:
                new Date().toISOString()

        });

    }

);

// ============================================
// SpaceX Mission Control
// Enterprise Restricted
// ============================================

app.get(

    '/api/enterprise/spacex',

    authenticateToken,

    enterpriseAccess.requireFeature(
        'SPACEX_MISSION_CONTROL'
    ),

    requirePermission(
        PERMISSIONS.SPACEX_VIEW
    ),

    (req, res) => {

        return res.json({

            organization:
                'SpaceX',

            feature:
                'SpaceX Mission Control',

            status:
                'AUTHORIZED',

            authorizedBy: {

                userId:
                    req.auth?.userId,

                role:
                    req.role,

                permission:
                    req.permission

            },

            systems: [

                'Launch Operations',

                'Rocket Telemetry',

                'Mission Tracking',

                'Engineering Systems',

                'Orbital Operations'

            ],

            timestamp:
                new Date().toISOString()

        });

    }

);

// ============================================
// NEOM Real-Time Telemetry
// ============================================

app.post(

    '/api/neom/telemetry',

    authenticateToken,

    requireOrganization,

    requirePermission(
        PERMISSIONS.NEOM_VIEW
    ),

    async (req, res, next) => {

        try {

            const telemetry =
                await neomRealtimeTelemetry.ingest(

                    req.body,

                    req.auth

                );

            return res.status(201).json({

                status:
                    'TELEMETRY_INGESTED',

                telemetry

            });

        } catch (error) {

            return next(error);

        }

    }

);

// ============================================
// NEOM Telemetry Status
// ============================================

app.get(

    '/api/neom/telemetry/status',

    authenticateToken,

    requireOrganization,

    requirePermission(
        PERMISSIONS.NEOM_VIEW
    ),

    (req, res) => {

        return res.json(
            neomRealtimeTelemetry.status()
        );

    }

);

// ============================================
// NEOM Telemetry History
// ============================================

app.get(

    '/api/neom/telemetry/history',

    authenticateToken,

    requireOrganization,

    requirePermission(
        PERMISSIONS.NEOM_VIEW
    ),

    (req, res) => {

        return res.json({

            events:
                neomRealtimeTelemetry.getHistory({

                    zone:
                        req.query.zone,

                    domain:
                        req.query.domain,

                    assetId:
                        req.query.assetId,

                    limit:
                        req.query.limit

                })

        });

    }

);

// ============================================
// NEOM System Telemetry
// ============================================

app.get(

    '/api/neom/telemetry/system',

    authenticateToken,

    requireOrganization,

    requirePermission(
        PERMISSIONS.NEOM_VIEW
    ),

    (req, res) => {

        return res.json(
            neomRealtimeTelemetry.systemTelemetry()
        );

    }

);

// ============================================
// Prometheus Metrics
// ============================================

app.get(

    '/metrics',

    async (req, res, next) => {

        try {

            const metrics =
                await telemetryMetrics.metrics();

            res.set(
                'Content-Type',

                telemetryMetrics.contentType
            );

            return res.end(metrics);

        } catch (error) {

            return next(error);

        }

    }

);

// ============================================
// 404 Handler
// ============================================

app.use((req, res) => {

    return res.status(404).json({

        error:
            'ENDPOINT_NOT_FOUND',

        path:
            req.path

    });

});

// ============================================
// Error Handler
// ============================================

app.use((err, req, res, next) => {

    console.error(

        '[SUPREME Server Error]',

        err.message

    );

    const statusCode =
        err.statusCode ||
        err.status ||
        500;

    return res.status(statusCode).json({

        error:
            statusCode === 400
                ? 'BAD_REQUEST'
                : 'INTERNAL_SERVER_ERROR',

        message:
            process.env.NODE_ENV ===
            'production'
                ? undefined
                : err.message

    });

});

// ============================================
// Start Runtime
// ============================================

function startServer() {

    if (server) {

        console.log(
            '[SUPREME] Server is already running'
        );

        return server;

    }

    try {

        // ====================================
        // Start Integration Runtime
        // ====================================

        orchestrator.start();

        // ====================================
        // Start Scale Runtime
        // ====================================

        supremeScale.start();

        // ====================================
        // Start HTTP Server
        // ====================================

        server =
            app.listen(
                PORT,
                () => {

                    console.log('');

                    console.log(
                        '========================================'
                    );

                    console.log(
                        'SUPREME Platform v14.0.0 RUNNING'
                    );

                    console.log(
                        '========================================'
                    );

                    console.log(
                        'Port: http://localhost:' +
                        PORT
                    );

                    console.log(
                        'Health: http://localhost:' +
                        PORT +
                        '/api/health'
                    );

                    console.log(
                        'Dashboard: http://localhost:' +
                        PORT +
                        '/api/dashboard'
                    );

                    console.log(
                        'Integration: http://localhost:' +
                        PORT +
                        '/api/integration'
                    );

                    console.log(
                        'Scale Runtime: http://localhost:' +
                        PORT +
                        '/api/scale'
                    );

                    console.log(
                        'Metrics: http://localhost:' +
                        PORT +
                        '/metrics'
                    );

                    console.log(
                        'NEOM Status: http://localhost:' +
                        PORT +
                        '/api/neom/telemetry/status'
                    );

                    console.log(
                        'Detection API: POST http://localhost:' +
                        PORT +
                        '/api/detect'
                    );

                    console.log(
                        'Dev Token: POST http://localhost:' +
                        PORT +
                        '/api/auth/dev-token'
                    );

                    console.log(
                        '========================================'
                    );

                }
            );

        // ====================================
        // Socket.IO
        // ====================================

        io =
            new Server(
                server,
                {

                    cors: {

                        origin:
                            process.env.CORS_ORIGIN ||
                            '*',

                        methods: [
                            'GET',
                            'POST'
                        ]

                    }

                }
            );

        // ====================================
        // Attach NEOM Socket Server
        // ====================================

        neomRealtimeTelemetry
            .attachSocketServer(io);

        // ====================================
        // Start NEOM Adapters
        // ====================================

        neomRealtimeTelemetry
            .startAdapters();

        console.log(
            '📡 NEOM Real-Time Telemetry initialized'
        );

        server.on(
            'error',

            error => {

                console.error(

                    '[SUPREME Server Error]',

                    error.message

                );

            }
        );

        return server;

    } catch (error) {

        console.error(

            '[SUPREME Startup Error]',

            error.message

        );

        throw error;

    }

}

// ============================================
// Graceful Shutdown
// ============================================

function shutdown(signal) {

    if (shuttingDown) {

        return;

    }

    shuttingDown = true;

    console.log('');

    console.log(

        '[SUPREME] Received ' +
        signal +
        '. Shutting down...'

    );

    try {

        orchestrator.stop();

    } catch (error) {

        console.error(

            '[Integration Shutdown Error]',

            error.message

        );

    }

    try {

        supremeScale.stop();

    } catch (error) {

        console.error(

            '[Scale Shutdown Error]',

            error.message

        );

    }

    try {

        if (
            typeof neomRealtimeTelemetry.stopAdapters ===
            'function'
        ) {

            neomRealtimeTelemetry.stopAdapters();

        }

    } catch (error) {

        console.error(

            '[NEOM Shutdown Error]',

            error.message

        );

    }

    if (io) {

        try {

            io.close();

        } catch (error) {

            console.error(

                '[Socket.IO Shutdown Error]',

                error.message

            );

        }

    }

    if (!server) {

        process.exit(0);

        return;

    }

    server.close(() => {

        console.log(
            '[SUPREME] Server shutdown complete'
        );

        server = null;

        process.exit(0);

    });

    setTimeout(() => {

        console.error(
            '[SUPREME] Forced shutdown timeout reached'
        );

        process.exit(1);

    }, 10000).unref();

}

// ============================================
// Process Events
// ============================================

process.on(

    'SIGINT',

    () => shutdown('SIGINT')

);

process.on(

    'SIGTERM',

    () => shutdown('SIGTERM')

);

// ============================================
// Start Application
// ============================================

if (require.main === module) {

    startServer();

}

// ============================================
// Exports
// ============================================

module.exports = {

    app,

    startServer,

    shutdown,

    getServer: () => server,

    getIO: () => io

};

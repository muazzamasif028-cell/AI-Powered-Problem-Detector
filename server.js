'use strict';

// ============================================
// SUPREME Platform — Main Server
// ============================================

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');

require('dotenv').config();

const registry = require('./integration/registry');
const orchestrator = require('./integration/orchestrator');
const { registerCoreModules } = require('./integration/register-core');

// Optional integration health support
let integrationHealth = null;

try {
    integrationHealth = require('./integration/health');
} catch (error) {
    console.warn(
        '[Integration] Health module not available:',
        error.message
    );
}

// ============================================
// SUPREME SCALE RUNTIME
// ============================================

const supremeScale = require('./supreme-scale');

const app = express();
const PORT = process.env.PORT || 5000;

let server = null;
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

// ============================================
// Core Integration Modules
// ============================================

registerCoreModules();

// Register server module safely

const existingCoreServer = registry.get('core.server');

if (!existingCoreServer) {

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
// Root Route
// ============================================

app.get('/', (req, res) => {

    res.json({
        name: 'SUPREME Platform',
        version: '14.0.0',
        status: 'RUNNING',

        uptime: process.uptime(),

        timestamp: new Date().toISOString(),

        scale: supremeScale.status()
    });

});

// ============================================
// Health Check
// ============================================

app.get('/api/health', (req, res) => {

    const modules = registry.list();

    const health =
        integrationHealth &&
        typeof integrationHealth.getIntegrationHealth === 'function'
            ? integrationHealth.getIntegrationHealth()
            : null;

    res.json({

        status: 'HEALTHY',

        timestamp: new Date().toISOString(),

        uptime: process.uptime(),

        modules: {

            total: modules.length,

            enabled: modules.filter(
                module => module.enabled
            ).length,

            disabled: modules.filter(
                module => !module.enabled
            ).length

        },

        integration: health,

        orchestrator: orchestrator.status(),

        hyperscale: supremeScale.status()

    });

});

// ============================================
// Dashboard
// ============================================

app.get('/api/dashboard', (req, res) => {

    res.json({

        dashboard: 'SUPREME PLATFORM',

        version: '14.0.0',

        status: 'OPERATIONAL',

        modules: [

            'Problem Detector',

            'AI Engine',

            'Payment Gateway',

            'Domain Engine',

            'Satellite Layer',

            'Fleet Management',

            'Security Engine',

            'SUPREME Scale Runtime',

            'Backend HyperScale Runtime'

        ],

        integration: {

            registeredModules: registry.count(),

            orchestrator: orchestrator.status()

        },

        hyperscale: {

            status: supremeScale.status()

        },

        revenue: {

            mrr: '$1,250',

            arr: '$15,000'

        }

    });

});

// ============================================
// Integration Status
// ============================================

app.get('/api/integration', (req, res) => {

    let manifest = null;

    try {

        manifest = require('./integration/manifest');

    } catch (error) {

        manifest = {
            available: false
        };

    }

    const health =
        integrationHealth &&
        typeof integrationHealth.getIntegrationHealth === 'function'
            ? integrationHealth.getIntegrationHealth()
            : null;

    res.json({

        status: 'ACTIVE',

        manifest,

        health,

        orchestrator: orchestrator.status(),

        modules: registry.list(),

        hyperscale: supremeScale.status()

    });

});

// ============================================
// SUPREME SCALE STATUS
// ============================================

app.get('/api/scale', (req, res) => {

    res.json({

        status: 'ONLINE',

        runtime: supremeScale.status(),

        timestamp: new Date().toISOString()

    });

});

// ============================================
// Problem Detection API
// ============================================

app.post('/api/detect', (req, res, next) => {

    try {

        const detector =
            registry.get('problem-detector');

        if (!detector) {

            return res.status(503).json({

                error:
                    'DETECTION_SERVICE_UNAVAILABLE'

            });

        }

        const result =
            detector.detect(req.body?.input);

        return res.status(200).json(result);

    } catch (error) {

        return next(error);

    }

});

// ============================================
// 404 Handler
// ============================================

app.use((req, res) => {

    res.status(404).json({

        error: 'ENDPOINT_NOT_FOUND',

        path: req.path

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

    res.status(500).json({

        error: 'INTERNAL_SERVER_ERROR',

        message: err.message

    });

});

// ============================================
// Start Runtime
// ============================================

function startServer() {

    // Start integration orchestrator

    orchestrator.start();

    // Start SUPREME frontend + backend scale

    supremeScale.start();

    server = app.listen(PORT, () => {

        console.log('');
        console.log(
            '============================================'
        );

        console.log(
            'SUPREME Platform v14.0.0 RUNNING'
        );

        console.log(
            '============================================'
        );

        console.log(
            'Port: ' + PORT
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
            'Detection API: POST http://localhost:' +
            PORT +
            '/api/detect'
        );

        console.log(
            '============================================'
        );

    });

    return server;

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

    if (!server) {

        process.exit(0);

        return;

    }

    server.close(() => {

        console.log(
            '[SUPREME] Server shutdown complete'
        );

        process.exit(0);

    });

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

    shutdown

};

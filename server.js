'use strict';

// SUPREME Platform — Main Server

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');

require('dotenv').config();

const registry = require('./integration/registry');
const integrationHealth = require('./integration/health');
const orchestrator = require('./integration/orchestrator');

const app = express();
const PORT = process.env.PORT || 5000;

// --------------------------------------------------
// Middleware
// --------------------------------------------------

app.use(helmet());
app.use(cors());
app.use(compression());
app.use(express.json());

// --------------------------------------------------
// Core Integration Modules
// --------------------------------------------------

registry.register(
    'core.server',
    {
        initialize() {
            console.log('[Integration] Core server initialized');
        },

        shutdown() {
            console.log('[Integration] Core server shutdown');
        }
    },
    {
        version: '14.0.0',
        category: 'core'
    }
);

// --------------------------------------------------
// Routes
// --------------------------------------------------

app.get('/', (req, res) => {
    res.json({
        name: 'SUPREME Platform',
        version: '14.0.0',
        status: 'RUNNING',
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
    });
});

app.get('/api/health', (req, res) => {
    res.json({
        status: 'HEALTHY',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        integration: integrationHealth.getIntegrationHealth(),
        orchestrator: orchestrator.status()
    });
});

app.get('/api/integration', (req, res) => {
    res.json({
        manifest: require('./integration/manifest'),
        health: integrationHealth.getIntegrationHealth(),
        orchestrator: orchestrator.status(),
        modules: registry.list()
    });
});

app.get('/api/dashboard', (req, res) => {
    res.json({
        dashboard: 'SUPREME PLATFORM',
        version: '14.0.0',
        status: 'OPERATIONAL',

        modules: [
            'AI Engine',
            'Payment Gateway',
            'Domain Engine',
            'Satellite Layer',
            'Fleet Management',
            'Security Engine'
        ],

        integration: {
            status: integrationHealth.getIntegrationHealth().status,
            registeredModules: registry.count()
        },

        revenue: {
            mrr: '$1,250',
            arr: '$15,000'
        }
    });
});

// --------------------------------------------------
// 404 Handler
// --------------------------------------------------

app.use((req, res) => {
    res.status(404).json({
        error: 'ENDPOINT_NOT_FOUND',
        path: req.path
    });
});

// --------------------------------------------------
// Error Handler
// --------------------------------------------------

app.use((err, req, res, next) => {
    console.error('Server error:', err.message);

    res.status(500).json({
        error: 'INTERNAL_SERVER_ERROR'
    });
});

// --------------------------------------------------
// Start Runtime
// --------------------------------------------------

orchestrator.start();

const server = app.listen(PORT, () => {
    console.log('SUPREME Platform running on port ' + PORT);
    console.log('Health check: http://localhost:' + PORT + '/api/health');
    console.log('Integration: http://localhost:' + PORT + '/api/integration');
});

// --------------------------------------------------
// Graceful Shutdown
// --------------------------------------------------

function shutdown(signal) {
    console.log(`[Integration] Received ${signal}`);

    orchestrator.stop();

    server.close(() => {
        console.log('[Integration] Server shutdown complete');
        process.exit(0);
    });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

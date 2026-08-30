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

const supremeScale = require('./supreme-scale');

// ============================================
// Optional Integration Health
// ============================================

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
// Application
// ============================================

const app = express();
const PORT = Number(process.env.PORT) || 5000;

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

// Register core server only if it does not already exist.

if (!registry.get('core.server')) {
registry.register(
'core.server',
{
initialize() {
console.log(
'[Integration] Core server initialized'
);
},

```
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
```

}

// ============================================
// Helper Functions
// ============================================

function getIntegrationHealth() {
if (
integrationHealth &&
typeof integrationHealth.getIntegrationHealth === 'function'
) {
return integrationHealth.getIntegrationHealth();
}

```
return {
    available: false
};
```

}

function getScaleStatus() {
return supremeScale.status();
}

// ============================================
// Root Route
// ============================================

app.get('/', (req, res) => {
res.json({
name: 'SUPREME Platform',
version: '14.0.0',
status: 'RUNNING',

```
    uptime: process.uptime(),

    timestamp: new Date().toISOString(),

    scale: getScaleStatus()
});
```

});

// ============================================
// Health Check
// ============================================

app.get('/api/health', (req, res) => {
const modules = registry.list();

```
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

    integration: getIntegrationHealth(),

    orchestrator: orchestrator.status(),

    hyperscale: getScaleStatus()
});
```

});

// ============================================
// Dashboard
// ============================================

app.get('/api/dashboard', (req, res) => {
res.json({
dashboard: 'SUPREME PLATFORM',

```
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

    hyperscale: getScaleStatus(),

    revenue: {
        mrr: '$1,250',
        arr: '$15,000'
    }
});
```

});

// ============================================
// Integration Status
// ============================================

app.get('/api/integration', (req, res) => {
let manifest;

```
try {
    manifest = require('./integration/manifest');
} catch (error) {
    manifest = {
        available: false
    };
}

res.json({
    status: 'ACTIVE',

    manifest,

    health: getIntegrationHealth(),

    orchestrator: orchestrator.status(),

    modules: registry.list(),

    hyperscale: getScaleStatus()
});
```

});

// ============================================
// SUPREME Scale Status
// ============================================

app.get('/api/scale', (req, res) => {
const runtime = getScaleStatus();

```
res.json({
    status: runtime.started
        ? 'ONLINE'
        : 'OFFLINE',

    runtime,

    timestamp: new Date().toISOString()
});
```

});

// ============================================
// Problem Detection API
// ============================================

app.post('/api/detect', (req, res, next) => {
try {
const detector =
registry.get('problem-detector');

```
    if (!detector) {
        return res.status(503).json({
            error:
                'DETECTION_SERVICE_UNAVAILABLE'
        });
    }

    const input = req.body?.input;

    if (
        typeof input !== 'string' ||
        input.trim().length === 0
    ) {
        return res.status(400).json({
            error: 'DETECTION_INPUT_REQUIRED'
        });
    }

    const result =
        detector.detect(input.trim());

    return res.status(200).json(result);

} catch (error) {
    return next(error);
}
```

});

// ============================================
// 404 Handler
// ============================================

app.use((req, res) => {
res.status(404).json({
error: 'ENDPOINT_NOT_FOUND',

```
    path: req.path
});
```

});

// ============================================
// Error Handler
// ============================================

app.use((err, req, res, next) => {
console.error(
'[SUPREME Server Error]',
err.message
);

```
res.status(500).json({
    error: 'INTERNAL_SERVER_ERROR',

    message:
        process.env.NODE_ENV === 'production'
            ? undefined
            : err.message
});
```

});

// ============================================
// Start Runtime
// ============================================

function startServer() {

```
// Prevent duplicate server startup.

if (server) {
    console.log(
        '[SUPREME] Server is already running'
    );

    return server;
}

try {

    // Start integration runtime.

    orchestrator.start();

    // Start frontend + backend scale runtime.

    supremeScale.start();

} catch (error) {

    console.error(
        '[SUPREME Startup Error]',
        error.message
    );

    throw error;
}

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

    console.log('Port: ' + PORT);

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

server.on('error', error => {

    console.error(
        '[SUPREME Server Error]',
        error.message
    );

});

return server;
```

}

// ============================================
// Graceful Shutdown
// ============================================

function shutdown(signal) {

```
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

    server = null;

    process.exit(0);
});

// Force exit if connections do not close.

setTimeout(() => {

    console.error(
        '[SUPREME] Forced shutdown timeout reached'
    );

    process.exit(1);

}, 10000).unref();
```

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

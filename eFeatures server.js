warning: in the working copy of 'server.js', LF will be replaced by CRLF the next time Git touches it
[1mdiff --git a/server.js b/server.js[m
[1mindex 35b261f..7409b46 100644[m
[1m--- a/server.js[m
[1m+++ b/server.js[m
[36m@@ -1,67 +1,343 @@[m
[31m-﻿// SUPREME Platform — Main Server[m
[32m+[m[32m'use strict';[m
[32m+[m
 const express = require('express');[m
 const cors = require('cors');[m
 const helmet = require('helmet');[m
 const compression = require('compression');[m
[32m+[m
 require('dotenv').config();[m
 [m
[32m+[m[32mconst registry = require('./integration/registry');[m
[32m+[m[32mconst orchestrator = require('./integration/orchestrator');[m
[32m+[m[32mconst { registerCoreModules } = require('./integration/register-core');[m
[32m+[m
[32m+[m[32m// SUPREME Frontend + Backend HyperScale Runtime[m
[32m+[m[32mconst supremeScale = require('./supreme-scale');[m
[32m+[m[32mconst enterpriseAccess = require('./security/enterprise-access');[m
[32m+[m
 const app = express();[m
 const PORT = process.env.PORT || 5000;[m
 [m
[32m+[m[32mlet server = null;[m
[32m+[m[32mlet shuttingDown = false;[m
[32m+[m
[32m+[m[32m// ============================================[m
[32m+[m[32m// Core Integration[m
[32m+[m[32m// ============================================[m
[32m+[m
[32m+[m[32mregisterCoreModules();[m
[32m+[m
[32m+[m[32m// ============================================[m
 // Middleware[m
[32m+[m[32m// ============================================[m
[32m+[m
 app.use(helmet());[m
 app.use(cors());[m
 app.use(compression());[m
[31m-app.use(express.json());[m
 [m
[31m-// Routes[m
[32m+[m[32mapp.use(express.json({[m
[32m+[m[32m    limit: '10mb'[m
[32m+[m[32m}));[m
[32m+[m
[32m+[m[32m// ============================================[m
[32m+[m[32m// Root[m
[32m+[m[32m// ============================================[m
[32m+[m
 app.get('/', (req, res) => {[m
[31m-    res.json({ [m
[31m-        name: 'SUPREME Platform', [m
[31m-        version: '14.0.0', [m
[32m+[m[32m    res.json({[m
[32m+[m[32m        name: 'SUPREME Platform',[m
[32m+[m[32m        version: '14.0.0',[m
         status: 'RUNNING',[m
         uptime: process.uptime(),[m
[31m-        timestamp: new Date().toISOString()[m
[32m+[m[32m        timestamp: new Date().toISOString(),[m
[32m+[m
[32m+[m[32m        scale: supremeScale.status()[m
     });[m
 });[m
 [m
[32m+[m[32m// ============================================[m
[32m+[m[32m// Health[m
[32m+[m[32m// ============================================[m
[32m+[m
 app.get('/api/health', (req, res) => {[m
[31m-    res.json({ [m
[31m-        status: 'HEALTHY', [m
[32m+[m[32m    const modules = registry.list();[m
[32m+[m
[32m+[m[32m    res.json({[m
[32m+[m[32m        status: 'HEALTHY',[m
         timestamp: new Date().toISOString(),[m
[31m-        uptime: process.uptime()[m
[32m+[m[32m        uptime: process.uptime(),[m
[32m+[m
[32m+[m[32m        integration: {[m
[32m+[m[32m            modules: {[m
[32m+[m[32m                total: modules.length,[m
[32m+[m[32m                enabled: modules.filter([m
[32m+[m[32m                    module => module.enabled[m
[32m+[m[32m                ).length,[m
[32m+[m[32m                disabled: modules.filter([m
[32m+[m[32m                    module => !module.enabled[m
[32m+[m[32m                ).length[m
[32m+[m[32m            },[m
[32m+[m
[32m+[m[32m            orchestrator: orchestrator.status()[m
[32m+[m[32m        },[m
[32m+[m
[32m+[m[32m        hyperscale: supremeScale.status()[m
     });[m
 });[m
 [m
[32m+[m[32m// ============================================[m
[32m+[m[32m// Dashboard[m
[32m+[m[32m// ============================================[m
[32m+[m
 app.get('/api/dashboard', (req, res) => {[m
     res.json({[m
         dashboard: 'SUPREME PLATFORM',[m
         version: '14.0.0',[m
         status: 'OPERATIONAL',[m
[32m+[m
         modules: [[m
[32m+[m[32m            'Problem Detector',[m
             'AI Engine',[m
             'Payment Gateway',[m
             'Domain Engine',[m
             'Satellite Layer',[m
             'Fleet Management',[m
[31m-            'Security Engine'[m
[32m+[m[32m            'Security Engine',[m
[32m+[m[32m            'SUPREME Scale Runtime',[m
[32m+[m[32m            'Backend HyperScale Runtime'[m
         ],[m
[31m-        revenue: { mrr: ',250', arr: ',167,000' }[m
[32m+[m
[32m+[m[32m        integration: {[m
[32m+[m[32m            registeredModules: registry.count(),[m
[32m+[m[32m            orchestrator: orchestrator.status()[m
[32m+[m[32m        },[m
[32m+[m
[32m+[m[32m        hyperscale: supremeScale.status()[m
[32m+[m[32m    });[m
[32m+[m[32m});[m
[32m+[m
[32m+[m[32m// ============================================[m
[32m+[m[32m// Integration Status[m
[32m+[m[32m// ============================================[m
[32m+[m
[32m+[m[32mapp.get('/api/integration', (req, res) => {[m
[32m+[m[32m    res.json({[m
[32m+[m[32m        status: 'ACTIVE',[m
[32m+[m
[32m+[m[32m        orchestrator: orchestrator.status(),[m
[32m+[m
[32m+[m[32m        modules: registry.list(),[m
[32m+[m
[32m+[m[32m        hyperscale: supremeScale.status()[m
     });[m
 });[m
 [m
[31m-// 404 handler[m
[32m+[m[32m// ============================================[m
[32m+[m[32m// SUPREME SCALE STATUS[m
[32m+[m[32m// ============================================[m
[32m+[m
[32m+[m[32mapp.get('/api/scale', (req, res) => {[m
[32m+[m[32m    res.json({[m
[32m+[m[32m        status: supremeScale.status().started[m
[32m+[m[32m            ? 'ONLINE'[m
[32m+[m[32m            : 'OFFLINE',[m
[32m+[m
[32m+[m[32m        runtime: supremeScale.status(),[m
[32m+[m
[32m+[m[32m        timestamp: new Date().toISOString()[m
[32m+[m[32m    });[m
[32m+[m[32m});[m
[32m+[m
[32m+[m[32m// ============================================[m
[32m+[m[32m// Problem Detection[m
[32m+[m[32m// ============================================[m
[32m+[m
[32m+[m[32mapp.post('/api/detect', (req, res, next) => {[m
[32m+[m[32m    try {[m
[32m+[m[32m        const detector = registry.get('problem-detector');[m
[32m+[m
[32m+[m[32m        if (!detector) {[m
[32m+[m[32m            return res.status(503).json({[m
[32m+[m[32m                error: 'DETECTION_SERVICE_UNAVAILABLE'[m
[32m+[m[32m            });[m
[32m+[m[32m        }[m
[32m+[m
[32m+[m[32m        const result = detector.detect(req.body?.input);[m
[32m+[m
[32m+[m[32m        return res.status(200).json(result);[m
[32m+[m
[32m+[m[32m    } catch (error) {[m
[32m+[m[32m        return next(error);[m
[32m+[m[32m    }[m
[32m+[m[32m});[m
[32m+[m
[32m+[m[32m// ============================================[m
[32m+[m[32m// 404[m
[32m+[m[32m// ============================================[m
[32m+[m
 app.use((req, res) => {[m
[31m-    res.status(404).json({ error: 'ENDPOINT_NOT_FOUND', path: req.path });[m
[32m+[m[32m    res.status(404).json({[m
[32m+[m[32m        error: 'ENDPOINT_NOT_FOUND',[m
[32m+[m[32m        path: req.path[m
[32m+[m[32m    });[m
 });[m
 [m
[31m-// Error handler[m
[32m+[m[32m// ============================================[m
[32m+[m[32m// Error Handler[m
[32m+[m[32m// ============================================[m
[32m+[m
 app.use((err, req, res, next) => {[m
[31m-    console.error('Server error:', err.message);[m
[31m-    res.status(500).json({ error: 'INTERNAL_SERVER_ERROR' });[m
[31m-});[m
[32m+[m[32m    console.error('[SUPREME Server Error]', err.message);[m
 [m
[31m-app.listen(PORT, () => {[m
[31m-    console.log('SUPREME Platform running on port ' + PORT);[m
[31m-    console.log('Health check: http://localhost:' + PORT + '/api/health');[m
[32m+[m[32m    res.status(500).json({[m
[32m+[m[32m        error: 'INTERNAL_SERVER_ERROR',[m
[32m+[m[32m        message: err.message[m
[32m+[m[32m    });[m
 });[m
[32m+[m
[32m+[m[32m// ============================================[m
[32m+[m[32m// Start Server[m
[32m+[m[32m// ============================================[m
[32m+[m
[32m+[m[32mfunction startServer() {[m
[32m+[m
[32m+[m[32m    if (server) {[m
[32m+[m[32m        return server;[m
[32m+[m[32m    }[m
[32m+[m
[32m+[m[32m    orchestrator.start();[m
[32m+[m
[32m+[m[32m    supremeScale.start();[m
[32m+[m
[32m+[m[32m    server = app.listen(PORT, () => {[m
[32m+[m
[32m+[m[32m        console.log('');[m
[32m+[m[32m        console.log('========================================');[m
[32m+[m[32m        console.log('SUPREME Platform v14.0.0 RUNNING');[m
[32m+[m[32m        console.log('========================================');[m
[32m+[m
[32m+[m[32m        console.log([m
[32m+[m[32m            'Port: http://localhost:' + PORT[m
[32m+[m[32m        );[m
[32m+[m
[32m+[m[32m        console.log([m
[32m+[m[32m            'Health: http://localhost:' +[m
[32m+[m[32m            PORT +[m
[32m+[m[32m            '/api/health'[m
[32m+[m[32m        );[m
[32m+[m
[32m+[m[32m        console.log([m
[32m+[m[32m            'Dashboard: http://localhost:' +[m
[32m+[m[32m            PORT +[m
[32m+[m[32m            '/api/dashboard'[m
[32m+[m[32m        );[m
[32m+[m
[32m+[m[32m        console.log([m
[32m+[m[32m            'Integration: http://localhost:' +[m
[32m+[m[32m            PORT +[m
[32m+[m[32m            '/api/integration'[m
[32m+[m[32m        );[m
[32m+[m
[32m+[m[32m        console.log([m
[32m+[m[32m            'Scale Runtime: http://localhost:' +[m
[32m+[m[32m            PORT +[m
[32m+[m[32m            '/api/scale'[m
[32m+[m[32m        );[m
[32m+[m
[32m+[m[32m        console.log([m
[32m+[m[32m            'Detection API: POST http://localhost:' +[m
[32m+[m[32m            PORT +[m
[32m+[m[32m            '/api/detect'[m
[32m+[m[32m        );[m
[32m+[m
[32m+[m[32m        console.log('========================================');[m
[32m+[m[32m    });[m
[32m+[m
[32m+[m[32m    server.on('error', (error) => {[m
[32m+[m[32m        console.error([m
[32m+[m[32m            '[SUPREME Server Startup Error]',[m
[32m+[m[32m            error.message[m
[32m+[m[32m        );[m
[32m+[m
[32m+[m[32m        if (error.code === 'EADDRINUSE') {[m
[32m+[m[32m            console.error([m
[32m+[m[32m                'Port ' + PORT + ' is already in use.'[m
[32m+[m[32m            );[m
[32m+[m[32m        }[m
[32m+[m[32m    });[m
[32m+[m
[32m+[m[32m    return server;[m
[32m+[m[32m}[m
[32m+[m
[32m+[m[32m// ============================================[m
[32m+[m[32m// Graceful Shutdown[m
[32m+[m[32m// ============================================[m
[32m+[m
[32m+[m[32mfunction shutdown(signal) {[m
[32m+[m
[32m+[m[32m    if (shuttingDown) {[m
[32m+[m[32m        return;[m
[32m+[m[32m    }[m
[32m+[m
[32m+[m[32m    shuttingDown = true;[m
[32m+[m
[32m+[m[32m    console.log('');[m
[32m+[m[32m    console.log([m
[32m+[m[32m        '[SUPREME] ' +[m
[32m+[m[32m        signal +[m
[32m+[m[32m        ' received. Shutting down...'[m
[32m+[m[32m    );[m
[32m+[m
[32m+[m[32m    try {[m
[32m+[m[32m        orchestrator.stop();[m
[32m+[m[32m    } catch (error) {[m
[32m+[m[32m        console.error([m
[32m+[m[32m            '[Integration Shutdown Error]',[m
[32m+[m[32m            error.message[m
[32m+[m[32m        );[m
[32m+[m[32m    }[m
[32m+[m
[32m+[m[32m    try {[m
[32m+[m[32m        supremeScale.stop();[m
[32m+[m[32m    } catch (error) {[m
[32m+[m[32m        console.error([m
[32m+[m[32m            '[Scale Shutdown Error]',[m
[32m+[m[32m            error.message[m
[32m+[m[32m        );[m
[32m+[m[32m    }[m
[32m+[m
[32m+[m[32m    if (!server) {[m
[32m+[m[32m        process.exit(0);[m
[32m+[m[32m        return;[m
[32m+[m[32m    }[m
[32m+[m
[32m+[m[32m    server.close(() => {[m
[32m+[m
[32m+[m[32m        console.log([m
[32m+[m[32m            '[SUPREME] Server shutdown complete'[m
[32m+[m[32m        );[m
[32m+[m
[32m+[m[32m        process.exit(0);[m
[32m+[m[32m    });[m
[32m+[m[32m}[m
[32m+[m
[32m+[m[32mprocess.on('SIGINT', () => shutdown('SIGINT'));[m
[32m+[m[32mprocess.on('SIGTERM', () => shutdown('SIGTERM'));[m
[32m+[m
[32m+[m[32m// ============================================[m
[32m+[m[32m// Start Application[m
[32m+[m[32m// ============================================[m
[32m+[m
[32m+[m[32mif (require.main === module) {[m
[32m+[m[32m    startServer();[m
[32m+[m[32m}[m
[32m+[m
[32m+[m[32m// ============================================[m
[32m+[m[32m// Exports[m
[32m+[m[32m// ============================================[m
[32m+[m
[32m+[m[32mmodule.exports = {[m
[32m+[m[32m    app,[m
[32m+[m[32m    startServer,[m
[32m+[m[32m    shutdown[m
[32m+[m[32m};[m

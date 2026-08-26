// SUPREME Platform — Main Server
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(compression());
app.use(express.json());

// Routes
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
        uptime: process.uptime()
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
        revenue: { mrr: ',250', arr: ',167,000' }
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'ENDPOINT_NOT_FOUND', path: req.path });
});

// Error handler
app.use((err, req, res, next) => {
    console.error('Server error:', err.message);
    res.status(500).json({ error: 'INTERNAL_SERVER_ERROR' });
});

app.listen(PORT, () => {
    console.log('SUPREME Platform running on port ' + PORT);
    console.log('Health check: http://localhost:' + PORT + '/api/health');
});

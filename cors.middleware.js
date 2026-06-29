// ============================================================
// 🌐 middleware/cors.middleware.js
// SUPREME Enterprise CORS Configuration v11.0
// ============================================================
const cors = require('cors');

// =============================================
// 📊 ALLOWED ORIGINS CONFIGURATION
// =============================================
const allowedOrigins = [
    'https://supreme-os.com',
    'https://app.supreme-os.com',
    'https://admin.supreme-os.com',
    'https://api.supreme-os.com',
    'https://dashboard.supreme-os.com',
    'http://localhost:3000',
    'http://localhost:5173',
    'http://localhost:8080',
    'http://127.0.0.1:5500' // VS Code Live Server
];

// Dynamic origin checker
const originChecker = (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, Postman, server-to-server)
    if (!origin) {
        return callback(null, true);
    }
    
    // Check if origin is in allowed list
    if (allowedOrigins.includes(origin)) {
        return callback(null, true);
    }
    
    // In development, allow all origins
    if (process.env.NODE_ENV !== 'production') {
        console.log(`[CORS] Allowed development origin: ${origin}`);
        return callback(null, true);
    }
    
    // Wildcard subdomain support
    if (origin.endsWith('.supreme-os.com') || origin.endsWith('.vercel.app')) {
        return callback(null, true);
    }
    
    // Reject
    console.warn(`[CORS] Blocked origin: ${origin}`);
    callback(new Error(`Origin ${origin} not allowed by CORS policy`));
};

// =============================================
// ⚙️ CORS CONFIGURATION
// =============================================
const corsOptions = {
    origin: originChecker,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'],
    allowedHeaders: [
        'Content-Type',
        'Authorization',
        'X-Requested-With',
        'X-Request-ID',
        'X-Correlation-ID',
        'X-API-Key',
        'X-API-Version',
        'X-Client-Platform',
        'X-Device-ID',
        'Accept',
        'Accept-Language',
        'Cache-Control',
        'If-None-Match',
        'If-Modified-Since'
    ],
    exposedHeaders: [
        'X-Request-ID',
        'X-Correlation-ID',
        'X-API-Version',
        'X-RateLimit-Limit',
        'X-RateLimit-Remaining',
        'X-RateLimit-Reset',
        'X-Response-Time',
        'Content-Length',
        'ETag',
        'Last-Modified'
    ],
    credentials: true, // Allow cookies & auth headers
    maxAge: 86400, // Preflight cache: 24 hours
    preflightContinue: false,
    optionsSuccessStatus: 204
};

// =============================================
// 🔒 STRICT CORS (For sensitive endpoints)
// =============================================
const strictCorsOptions = {
    ...corsOptions,
    origin: allowedOrigins, // Only exact matches
    methods: ['GET', 'POST'],
    credentials: true,
    maxAge: 3600
};

// =============================================
// 🌍 PUBLIC CORS (For public endpoints)
// =============================================
const publicCorsOptions = {
    origin: '*', // Allow all origins
    methods: ['GET', 'OPTIONS', 'HEAD'],
    allowedHeaders: ['Content-Type', 'Accept'],
    credentials: false,
    maxAge: 86400
};

// =============================================
// 🎯 EXPORT MIDDLEWARE
// =============================================

// Default CORS middleware
const corsMiddleware = cors(corsOptions);

// Specialized CORS middleware
corsMiddleware.strict = cors(strictCorsOptions);
corsMiddleware.public = cors(publicCorsOptions);

// Custom origin adder (runtime)
corsMiddleware.addOrigin = (origin) => {
    if (!allowedOrigins.includes(origin)) {
        allowedOrigins.push(origin);
        console.log(`[CORS] Added origin: ${origin}`);
    }
};

corsMiddleware.removeOrigin = (origin) => {
    const index = allowedOrigins.indexOf(origin);
    if (index > -1) {
        allowedOrigins.splice(index, 1);
        console.log(`[CORS] Removed origin: ${origin}`);
    }
};

corsMiddleware.getAllowedOrigins = () => [...allowedOrigins];

module.exports = corsMiddleware;

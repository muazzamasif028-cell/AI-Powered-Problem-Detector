// ============================================================
// 🗜️ middleware/compression.middleware.js
// SUPREME Enterprise Compression v11.0
// ============================================================
const compression = require('compression');

// =============================================
// ⚙️ COMPRESSION CONFIGURATION
// =============================================
const compressionOptions = {
    // Minimum size in bytes to compress (1KB)
    threshold: 1024,
    
    // Compression level (0-9)
    // 0 = no compression, 9 = maximum compression
    level: process.env.NODE_ENV === 'production' ? 6 : 1,
    
    // Filter function to decide what to compress
    filter: (req, res) => {
        // Don't compress if already compressed
        if (req.headers['x-no-compression']) {
            return false;
        }
        
        // Don't compress small responses
        const contentLength = res.getHeader('Content-Length');
        if (contentLength && parseInt(contentLength) < 1024) {
            return false;
        }
        
        // Don't compress images/videos (already compressed)
        const contentType = res.getHeader('Content-Type');
        if (contentType && /^(image|video|audio|application\/pdf)/.test(contentType)) {
            return false;
        }
        
        // Compress everything else
        return compression.filter(req, res);
    },
    
    // Custom compression function decision
    // Brotli preferred, fallback to gzip, then deflate
    brotli: {
        enabled: true,
        params: {
            [require('zlib').constants.BROTLI_PARAM_QUALITY]: 5
        }
    }
};

// =============================================
// 📦 COMPRESSION MIDDLEWARE INSTANCE
// =============================================
const compressionMiddleware = compression(compressionOptions);

// =============================================
// 🎯 SPECIFIC COMPRESSION MIDDLEWARES
// =============================================

// Aggressive compression for large JSON responses
compressionMiddleware.aggressive = compression({
    ...compressionOptions,
    threshold: 512,
    level: 9
});

// Light compression for fast responses
compressionMiddleware.light = compression({
    ...compressionOptions,
    threshold: 4096,
    level: 1
});

// No compression (passthrough)
compressionMiddleware.none = (req, res, next) => next();

module.exports = compressionMiddleware;

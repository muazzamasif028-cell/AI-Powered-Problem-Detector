// ============================================================
// 🔢 middleware/requestId.middleware.js
// SUPREME Request ID Generator v11.0
// ============================================================
const crypto = require('crypto');

const requestIdMiddleware = (req, res, next) => {
    // Check if request ID already exists (from proxy/load balancer)
    const existingId = req.get('x-request-id') || req.get('x-correlation-id');
    
    if (existingId) {
        req.id = existingId;
    } else {
        // Generate unique request ID
        req.id = crypto.randomUUID();
    }
    
    // Set response header
    res.set('X-Request-ID', req.id);
    res.set('X-Correlation-ID', req.id);
    
    // Add to response locals for templates
    res.locals.requestId = req.id;
    
    next();
};

module.exports = requestIdMiddleware;

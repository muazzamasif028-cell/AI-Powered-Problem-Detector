// ============================================================
// 🌀 middleware/asyncHandler.js
// SUPREME Async Error Handler v11.0
// ============================================================

/**
 * Wraps async route handlers to catch errors automatically
 * Eliminates need for try/catch in every controller
 * 
 * Usage:
 * router.get('/path', asyncHandler(controller.method));
 */

const asyncHandler = (fn) => {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
};

/**
 * Wraps entire router with async error handling
 */
const asyncRouter = (router) => {
    const methods = ['get', 'post', 'put', 'delete', 'patch', 'use'];
    
    methods.forEach(method => {
        const original = router[method];
        router[method] = function(...args) {
            // Wrap all middleware/handlers
            const wrappedArgs = args.map(arg => {
                if (typeof arg === 'function' && arg.length <= 3) {
                    return asyncHandler(arg);
                }
                return arg;
            });
            return original.apply(this, wrappedArgs);
        };
    });
    
    return router;
};

module.exports = asyncHandler;
module.exports.asyncRouter = asyncRouter;

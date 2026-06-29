// ============================================================
// ❌ utils/AppError.js
// SUPREME Custom Error Class v11.0
// ============================================================

class AppError extends Error {
    constructor(message, statusCode, errorCode = 'INTERNAL_ERROR') {
        super(message);
        
        this.statusCode = statusCode;
        this.code = errorCode;
        this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
        this.isOperational = true; // Distinguish from programming errors
        
        // Capture stack trace
        Error.captureStackTrace(this, this.constructor);
        
        // Timestamp
        this.timestamp = new Date().toISOString();
    }

    /**
     * Common error factory methods
     */
    static badRequest(message = 'Bad Request', code = 'BAD_REQUEST') {
        return new AppError(message, 400, code);
    }

    static unauthorized(message = 'Unauthorized', code = 'UNAUTHORIZED') {
        return new AppError(message, 401, code);
    }

    static forbidden(message = 'Forbidden', code = 'FORBIDDEN') {
        return new AppError(message, 403, code);
    }

    static notFound(message = 'Resource Not Found', code = 'NOT_FOUND') {
        return new AppError(message, 404, code);
    }

    static conflict(message = 'Conflict', code = 'CONFLICT') {
        return new AppError(message, 409, code);
    }

    static tooMany(message = 'Too Many Requests', code = 'RATE_LIMIT') {
        return new AppError(message, 429, code);
    }

    static internal(message = 'Internal Server Error', code = 'INTERNAL_ERROR') {
        return new AppError(message, 500, code);
    }

    static serviceUnavailable(message = 'Service Unavailable', code = 'SERVICE_DOWN') {
        return new AppError(message, 503, code);
    }

    /**
     * Convert to JSON for API response
     */
    toJSON() {
        return {
            success: false,
            error: {
                code: this.code,
                message: this.message,
                statusCode: this.statusCode,
                timestamp: this.timestamp
            }
        };
    }
}

module.exports = AppError;

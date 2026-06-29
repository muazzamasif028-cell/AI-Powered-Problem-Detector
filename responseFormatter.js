// ============================================================
// 📦 utils/responseFormatter.js
// SUPREME Response Formatter v11.0
// ============================================================

// =============================================
// ✅ SUCCESS RESPONSE
// =============================================
const successResponse = (res, data = null, message = 'Success', statusCode = 200, meta = {}) => {
    const response = {
        success: true,
        message,
        timestamp: new Date().toISOString()
    };
    
    // Add data if present
    if (data !== null && data !== undefined) {
        response.data = data;
    }
    
    // Add pagination meta if present
    if (meta.page || meta.total !== undefined) {
        response.meta = {
            page: meta.page || 1,
            limit: meta.limit || 10,
            total: meta.total || 0,
            totalPages: meta.totalPages || Math.ceil((meta.total || 0) / (meta.limit || 10)),
            ...meta
        };
    }
    
    // Add request ID if available
    if (res.req?.id) {
        response.requestId = res.req.id;
    }
    
    return res.status(statusCode).json(response);
};

// =============================================
// 🏗️ CREATED RESPONSE (201)
// =============================================
const createdResponse = (res, data, message = 'Resource created successfully') => {
    return successResponse(res, data, message, 201);
};

// =============================================
// 📄 PAGINATED RESPONSE
// =============================================
const paginatedResponse = (res, data, pagination, message = 'Data retrieved successfully') => {
    return successResponse(res, data, message, 200, pagination);
};

// =============================================
// 📋 LIST RESPONSE
// =============================================
const listResponse = (res, items, total, page = 1, limit = 10, message = 'List retrieved successfully') => {
    const totalPages = Math.ceil(total / limit);
    
    return successResponse(res, items, message, 200, {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
    });
};

// =============================================
// ❌ ERROR RESPONSE
// =============================================
const errorResponse = (res, message = 'Internal Server Error', statusCode = 500, errorCode = 'INTERNAL_ERROR', details = null) => {
    const response = {
        success: false,
        error: {
            code: errorCode,
            message,
            statusCode,
            timestamp: new Date().toISOString()
        }
    };
    
    // Add details if present (validation errors etc)
    if (details) {
        response.error.details = details;
    }
    
    // Add request ID if available
    if (res.req?.id) {
        response.requestId = res.req.id;
    }
    
    // Add stack trace in development
    if (process.env.NODE_ENV === 'development' && details?.stack) {
        response.error.stack = details.stack;
    }
    
    return res.status(statusCode).json(response);
};

// =============================================
// 🔢 SPECIFIC ERROR RESPONSES
// =============================================
const badRequest = (res, message = 'Bad Request', details = null) => {
    return errorResponse(res, message, 400, 'BAD_REQUEST', details);
};

const unauthorized = (res, message = 'Unauthorized') => {
    return errorResponse(res, message, 401, 'UNAUTHORIZED');
};

const forbidden = (res, message = 'Forbidden') => {
    return errorResponse(res, message, 403, 'FORBIDDEN');
};

const notFound = (res, message = 'Resource Not Found') => {
    return errorResponse(res, message, 404, 'NOT_FOUND');
};

const conflict = (res, message = 'Conflict') => {
    return errorResponse(res, message, 409, 'CONFLICT');
};

const validationError = (res, errors) => {
    return errorResponse(res, 'Validation Error', 422, 'VALIDATION_ERROR', errors);
};

const tooMany = (res, message = 'Too Many Requests') => {
    return errorResponse(res, message, 429, 'RATE_LIMIT_EXCEEDED');
};

const serverError = (res, message = 'Internal Server Error') => {
    return errorResponse(res, message, 500, 'INTERNAL_ERROR');
};

const serviceUnavailable = (res, message = 'Service Temporarily Unavailable') => {
    return errorResponse(res, message, 503, 'SERVICE_UNAVAILABLE');
};

// =============================================
// 📊 NO CONTENT RESPONSE (204)
// =============================================
const noContent = (res) => {
    return res.status(204).send();
};

// =============================================
// 🔄 NOT MODIFIED RESPONSE (304)
// =============================================
const notModified = (res) => {
    return res.status(304).send();
};

// =============================================
// 🤫 EXPORT
// =============================================
module.exports = {
    success: successResponse,
    created: createdResponse,
    paginated: paginatedResponse,
    list: listResponse,
    error: errorResponse,
    badRequest,
    unauthorized,
    forbidden,
    notFound,
    conflict,
    validationError,
    tooMany,
    serverError,
    serviceUnavailable,
    noContent,
    notModified
};

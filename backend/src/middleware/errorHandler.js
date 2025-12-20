/**
 * Centralized Error Handling Middleware
 * Catches all errors from route handlers and returns consistent error responses
 */
const errorHandler = (err, req, res, next) => {
    // Log error for debugging (but don't expose sensitive info)
    console.error('[Error Handler]', {
        message: err.message,
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
        path: req.path,
        method: req.method,
        timestamp: new Date().toISOString()
    });
    
    // Determine status code
    let statusCode = err.status || err.statusCode || 500;
    
    // Don't expose internal errors in production
    const isDevelopment = process.env.NODE_ENV === 'development';
    
    // Standardized error response
    const errorResponse = {
        success: false,
        error: isDevelopment ? err.message : 'An error occurred. Please try again later.',
        ...(isDevelopment && { 
            stack: err.stack,
            details: err.details 
        })
    };
    
    // Handle specific error types
    if (err.name === 'ValidationError') {
        statusCode = 400;
        errorResponse.error = 'Validation error';
        errorResponse.details = err.message;
    } else if (err.name === 'CastError') {
        statusCode = 400;
        errorResponse.error = 'Invalid ID format';
    } else if (err.name === 'JsonWebTokenError') {
        statusCode = 401;
        errorResponse.error = 'Invalid token';
    } else if (err.name === 'TokenExpiredError') {
        statusCode = 401;
        errorResponse.error = 'Token expired';
    } else if (err.name === 'MongoError' && err.code === 11000) {
        statusCode = 409;
        errorResponse.error = 'Duplicate entry';
    }
    
    res.status(statusCode).json(errorResponse);
};

module.exports = errorHandler;

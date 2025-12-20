const rateLimit = require('express-rate-limit');

/**
 * Rate limiter for authentication endpoints
 * Prevents brute force attacks
 */
exports.authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 requests per window
    message: {
        success: false,
        error: 'Too many authentication attempts, please try again after 15 minutes'
    },
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    skipSuccessfulRequests: false, // Count successful requests too
    skipFailedRequests: false, // Count failed requests
});

/**
 * Rate limiter for password reset
 * More restrictive to prevent abuse
 */
exports.passwordResetLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 3, // 3 requests per hour
    message: {
        success: false,
        error: 'Too many password reset attempts, please try again later'
    },
    standardHeaders: true,
    legacyHeaders: false,
});

/**
 * General API rate limiter
 */
exports.apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // 100 requests per window
    message: {
        success: false,
        error: 'Too many requests, please try again later'
    },
    standardHeaders: true,
    legacyHeaders: false,
});

/**
 * Strict rate limiter for sensitive operations
 */
exports.strictLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 10, // 10 requests per hour
    message: {
        success: false,
        error: 'Too many requests, please try again later'
    },
    standardHeaders: true,
    legacyHeaders: false,
});

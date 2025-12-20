/**
 * Input Validation Middleware
 * Validates and sanitizes user inputs
 */
const validator = require('validator');

/**
 * Validate email format
 */
exports.validateEmail = (req, res, next) => {
    const { email } = req.body;
    if (email && typeof email === 'string') {
        if (!validator.isEmail(email)) {
            return res.status(400).json({ 
                success: false,
                error: 'Invalid email format' 
            });
        }
        // Normalize email (lowercase)
        req.body.email = email.toLowerCase().trim();
    }
    next();
};

/**
 * Validate password strength
 */
exports.validatePassword = (req, res, next) => {
    const { password } = req.body;
    if (password && typeof password === 'string') {
        if (password.length < 8) {
            return res.status(400).json({ 
                success: false,
                error: 'Password must be at least 8 characters long' 
            });
        }
        if (!/[A-Z]/.test(password)) {
            return res.status(400).json({ 
                success: false,
                error: 'Password must contain at least one uppercase letter' 
            });
        }
        if (!/[a-z]/.test(password)) {
            return res.status(400).json({ 
                success: false,
                error: 'Password must contain at least one lowercase letter' 
            });
        }
        if (!/[0-9]/.test(password)) {
            return res.status(400).json({ 
                success: false,
                error: 'Password must contain at least one number' 
            });
        }
        // Optional: check for special characters
        // if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
        //     return res.status(400).json({ error: 'Password must contain at least one special character' });
        // }
    }
    next();
};

/**
 * Sanitize string inputs to prevent XSS
 */
exports.sanitizeInput = (req, res, next) => {
    // Sanitize req.body string fields
    if (req.body && typeof req.body === 'object') {
        const sanitizeObject = (obj) => {
            if (Array.isArray(obj)) {
                return obj.map(item => {
                    if (typeof item === 'string') {
                        return validator.escape(item);
                    } else if (typeof item === 'object' && item !== null) {
                        return sanitizeObject(item);
                    }
                    return item;
                });
            } else if (obj !== null && typeof obj === 'object') {
                const sanitized = {};
                Object.keys(obj).forEach(key => {
                    if (typeof obj[key] === 'string') {
                        // Don't sanitize passwords or tokens (they're hashed/encrypted)
                        if (key.toLowerCase().includes('password') || 
                            key.toLowerCase().includes('token') ||
                            key.toLowerCase().includes('secret')) {
                            sanitized[key] = obj[key];
                        } else {
                            sanitized[key] = validator.escape(obj[key]);
                        }
                    } else if (typeof obj[key] === 'object' && obj[key] !== null) {
                        sanitized[key] = sanitizeObject(obj[key]);
                    } else {
                        sanitized[key] = obj[key];
                    }
                });
                return sanitized;
            }
            return obj;
        };
        
        req.body = sanitizeObject(req.body);
    }
    
    next();
};

/**
 * Validate ObjectId format
 * Can be used as middleware directly or with field name
 */
exports.validateObjectId = (fieldName) => {
    return (req, res, next) => {
        const mongoose = require('mongoose');
        const idFields = ['id', '_id', 'moduleId', 'userId', 'subsectionId', 'sectionId', 'chapterId'];
        
        // If fieldName provided, validate that specific field
        if (fieldName) {
            const value = req.params[fieldName] || req.body[fieldName] || req.query[fieldName];
            if (value && !mongoose.Types.ObjectId.isValid(value)) {
                return res.status(400).json({
                    success: false,
                    error: `Invalid ${fieldName} format`
                });
            }
            return next();
        }
        
        // Otherwise, validate all common ID fields
        // Check params
        Object.keys(req.params).forEach(key => {
            if (idFields.some(field => key.toLowerCase().includes(field.toLowerCase()))) {
                if (req.params[key] && !mongoose.Types.ObjectId.isValid(req.params[key])) {
                    return res.status(400).json({
                        success: false,
                        error: `Invalid ${key} format`
                    });
                }
            }
        });
        
        // Check body
        if (req.body) {
            idFields.forEach(field => {
                if (req.body[field] && !mongoose.Types.ObjectId.isValid(req.body[field])) {
                    return res.status(400).json({
                        success: false,
                        error: `Invalid ${field} format`
                    });
                }
            });
        }
        
        next();
    };
};

/**
 * Validate required fields
 */
exports.validateRequired = (fields) => {
    return (req, res, next) => {
        const missing = [];
        fields.forEach(field => {
            if (!req.body[field] || (typeof req.body[field] === 'string' && req.body[field].trim() === '')) {
                missing.push(field);
            }
        });
        
        if (missing.length > 0) {
            return res.status(400).json({
                success: false,
                error: `Missing required fields: ${missing.join(', ')}`
            });
        }
        
        next();
    };
};

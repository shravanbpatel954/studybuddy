/**
 * NoSQL Injection Protection Middleware
 * Sanitizes req.params, req.query, and req.body to prevent MongoDB operator injection
 */
const sanitizeMongo = (req, res, next) => {
    // Sanitize req.params
    if (req.params) {
        Object.keys(req.params).forEach(key => {
            if (typeof req.params[key] === 'string') {
                // Remove MongoDB operators ($) and other dangerous characters
                req.params[key] = req.params[key].replace(/[$]/g, '');
                // Validate ObjectId format if it looks like an ObjectId
                if (req.params[key].length === 24 && /^[a-f0-9]+$/i.test(req.params[key])) {
                    // Valid ObjectId format, keep as is
                } else if (req.params[key].length > 0) {
                    // Additional sanitization for non-ObjectId params
                    req.params[key] = req.params[key].replace(/[<>{}[\]]/g, '');
                }
            }
        });
    }
    
    // Sanitize req.query
    if (req.query) {
        Object.keys(req.query).forEach(key => {
            if (typeof req.query[key] === 'string') {
                // Remove MongoDB operators
                req.query[key] = req.query[key].replace(/[$]/g, '');
                // Remove other dangerous characters
                req.query[key] = req.query[key].replace(/[<>{}[\]]/g, '');
            } else if (Array.isArray(req.query[key])) {
                // Sanitize array elements
                req.query[key] = req.query[key].map(item => {
                    if (typeof item === 'string') {
                        return item.replace(/[$<>{}[\]]/g, '');
                    }
                    return item;
                });
            }
        });
    }
    
    // Sanitize req.body (but preserve structure for valid data)
    if (req.body && typeof req.body === 'object') {
        const sanitizeObject = (obj) => {
            if (Array.isArray(obj)) {
                return obj.map(item => {
                    if (typeof item === 'string') {
                        return item.replace(/[$<>{}[\]]/g, '');
                    } else if (typeof item === 'object' && item !== null) {
                        return sanitizeObject(item);
                    }
                    return item;
                });
            } else if (obj !== null && typeof obj === 'object') {
                const sanitized = {};
                Object.keys(obj).forEach(key => {
                    // Remove keys that start with $ (MongoDB operators)
                    if (key.startsWith('$')) {
                        return; // Skip this key
                    }
                    if (typeof obj[key] === 'string') {
                        sanitized[key] = obj[key].replace(/[$<>{}[\]]/g, '');
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
        
        // Only sanitize if body contains potential injection patterns
        const bodyStr = JSON.stringify(req.body);
        if (bodyStr.includes('$') || bodyStr.includes('<') || bodyStr.includes('>')) {
            req.body = sanitizeObject(req.body);
        }
    }
    
    next();
};

module.exports = sanitizeMongo;

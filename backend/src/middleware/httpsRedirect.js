/**
 * HTTPS Redirect Middleware
 * Redirects HTTP requests to HTTPS in production
 */
const httpsRedirect = (req, res, next) => {
    // Only enforce HTTPS in production
    if (process.env.NODE_ENV === 'production') {
        // Check if request is already HTTPS (via proxy headers)
        const isHttps = req.header('x-forwarded-proto') === 'https' || 
                       req.secure || 
                       req.protocol === 'https';
        
        if (!isHttps) {
            // Redirect to HTTPS
            const httpsUrl = `https://${req.header('host')}${req.url}`;
            return res.redirect(301, httpsUrl);
        }
    }
    
    // Continue to next middleware
    next();
};

module.exports = httpsRedirect;

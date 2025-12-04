const jwt = require("jsonwebtoken")
class JWTService{
        static jwt_auth ="$%^&*(O%^&*()_{"
    static generateToken = (payload)=>{
        const token = jwt.sign(payload,JWTService.jwt_auth,{
            expiresIn:"30d"
        })
        return token
    }

    static verifyToken = (token,key)=>{
        const payload = jwt.verify(token,JWTService.jwt_auth)
        return payload[key]
    }
}

// Robust JWT middleware for Express
function verifyToken(req, res, next) {
    try {
        const authHeader = req.headers['authorization'] || req.headers['Authorization'];
        if (!authHeader || typeof authHeader !== 'string' || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ success: false, error: 'Missing or invalid Authorization header' });
        }
        const token = authHeader.split(' ')[1];
        if (!token || typeof token !== 'string') {
            return res.status(401).json({ success: false, error: 'JWT must be a string' });
        }

        // Verify and decode the token payload directly to avoid reliance on a single-key helper
        const decoded = jwt.verify(token, JWTService.jwt_auth);

        // If token payload contains userId field, normalize to req.user._id
        if (decoded && typeof decoded === 'object') {
            if (decoded.userId) {
                req.user = { _id: decoded.userId };
            } else {
                // attach full payload for downstream handlers if they need more info
                req.user = decoded;
            }
        } else if (decoded) {
            // token payload is a primitive (unlikely), keep it under _id
            req.user = { _id: decoded };
        } else {
            return res.status(401).json({ success: false, error: 'Invalid token payload' });
        }

        next();
    } catch (error) {
        return res.status(401).json({ success: false, error: error.message });
    }
}

module.exports = { JWTService, verifyToken };
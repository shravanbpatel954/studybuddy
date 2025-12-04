const express = require('express');
const router = express.Router();
const User = require('../models/User.mdoels');
const { VerifyToken } = require('../controller/AuthController');
const { ensureUserFields } = require('../utils/userHelpers');

// GET /api/user/points - returns { success: true, points }
router.get('/points', VerifyToken, async (req, res) => {
    try {
        const userId = req.user && (req.user._id || req.user);
        if (!userId) return res.status(401).json({ success: false, error: 'Not authenticated' });
        
        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ success: false, error: 'User not found' });
        
        // Ensure points and unlockedGames fields exist
        await ensureUserFields(user);
        
        return res.json({ success: true, points: user.points || 0 });
    } catch (err) {
        console.error('GET /user/points error', err);
        return res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;

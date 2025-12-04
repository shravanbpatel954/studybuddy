const express = require('express');
const router = express.Router();
const { VerifyToken } = require('../controller/AuthController');
const User = require('../models/User.mdoels');
const pointsHandler = require('../utils/pointsHandler');

// POST /api/points/unlock-game
// Body: { gameName: string }
router.post('/unlock-game', VerifyToken, async (req, res) => {
    try {
        const userId = req.user?._id;
        const { gameName } = req.body;
        
        if (!userId) return res.status(401).json({ success: false, error: 'Not authenticated' });
        if (!gameName) return res.status(400).json({ success: false, error: 'gameName required' });

        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ success: false, error: 'User not found' });

        const UNLOCK_COST = 1000; // Fixed cost of 1000 points per game

        // Check if user has enough points
        if ((user.points || 0) < UNLOCK_COST) {
            return res.status(400).json({ 
                success: false, 
                error: 'Not enough points',
                required: UNLOCK_COST,
                current: user.points || 0
            });
        }

        // Check if game already unlocked
        if (user.unlockedGames && user.unlockedGames.includes(gameName)) {
            return res.status(400).json({ success: false, error: 'Game already unlocked' });
        }

        // Ensure points field exists
        if (typeof user.points !== 'number' || isNaN(user.points)) {
            user.points = 0;
        }
        
        // Deduct points and unlock
        user.points -= UNLOCK_COST;
        user.unlockedGames = user.unlockedGames || [];
        user.unlockedGames.push(gameName);
        user.markModified('points');
        user.markModified('unlockedGames');
        await user.save();

        console.log(`User ${userId} unlocked game ${gameName} for ${UNLOCK_COST} points. Remaining: ${user.points}`);

        return res.json({ 
            success: true, 
            newPoints: user.points,
            unlockedGame: gameName,
            cost: UNLOCK_COST
        });
    } catch (err) {
        console.error('Unlock game error:', err);
        return res.status(500).json({ success: false, error: err.message });
    }
});

// Test route - GET /api/points/test
// Creates a test attempt with 5 correct answers in 30 seconds
router.post('/test', VerifyToken, async (req, res) => {
    try {
        const userId = req.user?._id;
        if (!userId) return res.status(401).json({ success: false, error: 'Not authenticated' });
        
        // Test case: 5 correct answers in 30 seconds
        const result = await pointsHandler.awardPointsForAttempt({
            userId,
            correct: 5,
            totalQuestions: 5,
            timeMs: 30000 // 30 seconds
        });

        if (result.success) {
            const user = await User.findById(userId);
            return res.json({
                success: true,
                testCase: {
                    correct: 5,
                    totalQuestions: 5,
                    timeMs: 30000,
                    expectedBase: 50, // 5 correct * 10 points
                    expectedSpeedBonus: 25 // (15 - 6 seconds per question) * 5 correct = 45, capped at 25
                },
                result: {
                    earned: result.earned,
                    newTotal: user.points
                }
            });
        }
        return res.status(500).json({ success: false, error: 'Points not awarded' });
    } catch (err) {
        console.error('Test points error:', err);
        return res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;
const express = require('express');
const router = express.Router();
const axios = require('axios');
const { VerifyToken } = require('../controller/AuthController');
const User = require('../models/User.mdoels');
const pointsHandler = require('../utils/pointsHandler');

// Simple test endpoint to verify routing
router.get('/check', (req, res) => {
  res.json({ message: 'Test router is working' });
});

// Test doubt solver endpoint
router.post('/solve-doubt', (req, res) => {
  res.json({ message: 'Test response' });
});

// GET /api/test/points-flow - Test complete points workflow
router.get('/points-flow', VerifyToken, async (req, res) => {
    try {
        const userId = req.user?._id;
        if (!userId) return res.status(401).json({ success: false, error: 'Not authenticated' });

        // Step 1: Get initial balance
        let user = await User.findById(userId);
        const initialBalance = user.points || 0;
        console.log(`[Test Flow] Initial balance for user ${userId}: ${initialBalance}`);

        // Step 2: Award points for a test attempt
        const awardResult = await pointsHandler.awardPointsForAttempt({
            userId,
            correct: 5,
            totalQuestions: 5,
            timeMs: 30000 // 30 seconds
        });
        console.log(`[Test Flow] Points awarded: ${awardResult.earned}`);

        // Step 3: Get updated balance
        user = await User.findById(userId);
        const afterAwardBalance = user.points;
        console.log(`[Test Flow] Balance after award: ${afterAwardBalance}`);

        // Step 4: Try unlocking a game (costs 1000 points)
        let unlockResult;
        try {
            const unlockResponse = await axios.post('/api/points/unlock-game', 
                { gameName: 'testGame' },
                { 
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': req.headers.authorization
                    },
                    baseURL: 'http://localhost:8080'
                }
            );
            unlockResult = unlockResponse.data;
            console.log(`[Test Flow] Game unlock attempt:`, unlockResult);
        } catch (unlockErr) {
            console.error('[Test Flow] Game unlock failed:', unlockErr);
            unlockResult = { success: false, error: unlockErr.response?.data?.error || unlockErr.message };
        }

        // Step 5: Get final balance
        user = await User.findById(userId);
        const finalBalance = user.points;
        console.log(`[Test Flow] Final balance: ${finalBalance}`);

        return res.json({
            success: true,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role
            },
            flow: {
                initialBalance,
                pointsAwarded: awardResult.earned,
                balanceAfterAward: afterAwardBalance,
                unlockAttempt: unlockResult,
                finalBalance,
                expectedCalculation: {
                    basePoints: 50, // 5 correct * 10 points
                    speedBonus: Math.min(45, 25), // (15 - 6 seconds per question) * 5 correct = 45, capped at 25
                    total: 75 // 50 + 25
                }
            }
        });

    } catch (err) {
        console.error('[Test Flow] Error:', err);
        return res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;
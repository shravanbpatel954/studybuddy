const express = require('express');
const GameController = require('../controller/GameController');
const { verifyToken } = require('../utils/jwt');
const { apiLimiter } = require('../middleware/rateLimiter');
const { sanitizeInput } = require('../middleware/validation');

const router = express.Router();

// Protect all game routes with authentication
router.use(verifyToken);

// Mission routes
router.get('/missions', apiLimiter, GameController.getMissions);
router.post('/missions/:id/claim', apiLimiter, sanitizeInput, GameController.claimReward);
router.post('/progress/update', apiLimiter, sanitizeInput, GameController.updateProgress);
// Score submission (awards points and may auto-unlock games)
router.post('/score', apiLimiter, sanitizeInput, GameController.submitScore);
router.post('/unlock', apiLimiter, sanitizeInput, GameController.unlockRandom);
// Game time tracking routes
router.get('/time-status', apiLimiter, GameController.getTimeStatus);
router.post('/start', apiLimiter, sanitizeInput, GameController.startGame);
router.post('/end', apiLimiter, sanitizeInput, GameController.endGame);

module.exports = router;
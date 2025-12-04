const express = require('express');
const GameController = require('../controller/GameController');
const { verifyToken } = require('../utils/jwt');

const router = express.Router();

// Protect all game routes with authentication
router.use(verifyToken);

// Mission routes
router.get('/missions', GameController.getMissions);
router.post('/missions/:id/claim', GameController.claimReward);
router.post('/progress/update', GameController.updateProgress);
// Score submission (awards points and may auto-unlock games)
router.post('/score', GameController.submitScore);
router.post('/unlock', GameController.unlockRandom);
// Game time tracking routes
router.get('/time-status', GameController.getTimeStatus);
router.post('/start', GameController.startGame);
router.post('/end', GameController.endGame);

module.exports = router;
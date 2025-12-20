const express = require('express');
const router = express.Router();
const LeaderboardController = require('../controller/LeaderboardController');
const { VerifyToken } = require('../controller/AuthController');
const { apiLimiter } = require('../middleware/rateLimiter');

// Public: top N users
router.get('/', apiLimiter, (req, res) => LeaderboardController.top(req, res));

// Protected: get current user rank and neighbors
router.get('/me', VerifyToken, apiLimiter, (req, res) => LeaderboardController.me(req, res));

module.exports = router;

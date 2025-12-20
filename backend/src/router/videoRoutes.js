// backend00/src/router/videoRoutes.js
// Routes for video recommendation endpoints

const express = require('express');
const router = express.Router();
const { recommendVideo, recommendVideoAuth } = require('../controller/videoController');
const { VerifyToken } = require('../controller/AuthController');

// Public endpoint (no auth required)
router.get('/recommend', recommendVideo);

// Authenticated endpoint (optional, for future use)
router.get('/recommend-auth', VerifyToken, recommendVideoAuth);

module.exports = router;


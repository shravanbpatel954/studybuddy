const express = require('express');
const router = express.Router();
const QuizController = require('../controller/QuizController');
const { VerifyToken } = require('../controller/AuthController');

// Protect quiz endpoints with VerifyToken so req.user is populated
router.post('/next', VerifyToken, QuizController.next);
router.post('/answer', VerifyToken, QuizController.answer);
router.post('/attempt', VerifyToken, QuizController.attemptComplete);
router.get('/progress/:subsectionId', VerifyToken, QuizController.getProgress);
router.get('/attempts/:subsectionId', VerifyToken, QuizController.getAttempts);

// Development/test endpoints (no auth) so frontend can fetch deterministic data
// These are intentionally not protected. Remove or guard in production.
router.post('/test', QuizController.test);
router.post('/test/answer', QuizController.testAnswer);

module.exports = router;

const express = require('express');
const router = express.Router();
const QuizController = require('../controller/QuizController');
const { VerifyToken } = require('../controller/AuthController');
const { validateObjectId, sanitizeInput } = require('../middleware/validation');
const { apiLimiter } = require('../middleware/rateLimiter');

// Protect quiz endpoints with VerifyToken so req.user is populated
router.post('/next', VerifyToken, apiLimiter, sanitizeInput, QuizController.next);
router.post('/answer', VerifyToken, apiLimiter, sanitizeInput, QuizController.answer);
router.post('/attempt', VerifyToken, apiLimiter, sanitizeInput, QuizController.recordAttemptV2);
// New dedicated endpoint for saving quiz attempts (always saves, no skipping)
router.post('/attempts', VerifyToken, apiLimiter, sanitizeInput, QuizController.saveAttempt);
// AI-powered flashcard explanation for a given MCQ
router.post('/explain', VerifyToken, apiLimiter, sanitizeInput, QuizController.explain);
router.get('/history/:userId', VerifyToken, apiLimiter, QuizController.getQuizHistory);
router.get('/progress/:subsectionId', VerifyToken, apiLimiter, validateObjectId('subsectionId'), QuizController.getProgress);
router.get('/attempts/:subsectionId', VerifyToken, apiLimiter, validateObjectId('subsectionId'), QuizController.getAttempts);

// YouTube shorts endpoint for dynamic video fetching
router.get('/youtube-shorts', VerifyToken, apiLimiter, QuizController.getYouTubeShorts);

// YouTube videos endpoint for regular dynamic videos
router.get('/youtube-videos', VerifyToken, apiLimiter, QuizController.getYouTubeVideos);
// Backward-compatibility alias for older frontend paths
router.get('/v1/auth/quiz/youtube-videos', VerifyToken, apiLimiter, QuizController.getYouTubeVideos);

// Development/test endpoints (no auth) so frontend can fetch deterministic data
// These are intentionally not protected. Remove or guard in production.
router.post('/test', QuizController.test);
router.post('/test/answer', QuizController.testAnswer);

module.exports = router;

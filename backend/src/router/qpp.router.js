const express = require('express');
const router = express.Router();
const QPPController = require('../controller/QPPController');
const multer = require('multer');
const { verifyToken } = require('../utils/jwt');
const upload = multer({ storage: multer.memoryStorage() });

// Debug middleware to log all requests
router.use((req, res, next) => {
  console.log(`[QPP Router] ${req.method} ${req.path} - Full URL: ${req.originalUrl}`);
  console.log(`[QPP Router] Request headers:`, {
    authorization: req.headers.authorization ? 'Present' : 'Missing',
    'content-type': req.headers['content-type']
  });
  next();
});

// POST /api/v1/qpp/generate - Generate question paper with streaming
router.post('/generate', verifyToken, upload.fields([
  { name: 'syllabus', maxCount: 10 },
  { name: 'previousPapers', maxCount: 10 }
]), QPPController.generateQuestionPaper);

// POST /api/v1/qpp/download/pdf - Generate and download PDF
router.post('/download/pdf', verifyToken, (req, res, next) => {
  console.log('[QPP Router] PDF route handler called');
  QPPController.generatePDF(req, res).catch(next);
});

// POST /api/v1/qpp/download/word - Generate and download Word document
router.post('/download/word', verifyToken, (req, res, next) => {
  console.log('[QPP Router] Word route handler called');
  QPPController.generateWord(req, res).catch(next);
});

// GET /api/v1/qpp/test - Test endpoint
router.get('/test', QPPController.testConnection);

// Debug: Test download routes (no auth required for testing)
router.get('/download/test', (req, res) => {
  res.json({ 
    message: 'Download routes are working!',
    routes: [
      'POST /api/v1/qpp/download/pdf',
      'POST /api/v1/qpp/download/word'
    ],
    timestamp: new Date().toISOString()
  });
});

// Test route without auth to verify router is working
router.post('/download/test-post', (req, res) => {
  console.log('[QPP Router] Test POST route hit');
  res.json({ 
    message: 'POST route is working!',
    body: req.body,
    timestamp: new Date().toISOString()
  });
});

// 404 handler for unmatched routes in this router
router.use((req, res) => {
  console.log(`[QPP Router] 404 - Route not found: ${req.method} ${req.originalUrl}`);
  console.log(`[QPP Router] Available routes:`, router.stack
    .filter(r => r.route)
    .map(r => `${r.route.stack[0].method.toUpperCase()} ${r.route.path}`)
    .join(', '));
  res.status(404).json({
    success: false,
    error: 'Route not found',
    method: req.method,
    path: req.originalUrl,
    availableRoutes: router.stack
      .filter(r => r.route)
      .map(r => `${r.route.stack[0].method.toUpperCase()} ${r.route.path}`)
  });
});

module.exports = router;

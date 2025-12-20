// backend00/src/controller/videoController.js
// Controller for video recommendation endpoints

const { getBestVideoForTopic } = require('../utils/videoRecommendation');
const { VerifyToken } = require('./AuthController');

/**
 * GET /api/videos/recommend?topicTitle=...&description=...&keyPoints=...&examples=...
 * Returns either:
 *  - { mode: 'VIDEO', video: {...} }
 *  - { mode: 'AI_FALLBACK' }
 */
async function recommendVideo(req, res) {
  try {
    const { topicTitle, description = '', keyPoints = '', examples = '' } = req.query;

    if (!topicTitle || !topicTitle.trim()) {
      return res.status(400).json({ 
        success: false,
        error: 'topicTitle query parameter is required' 
      });
    }

    // Parse keyPoints and examples if they're JSON strings
    let parsedKeyPoints = [];
    let parsedExamples = [];

    try {
      if (keyPoints) {
        parsedKeyPoints = typeof keyPoints === 'string' 
          ? (keyPoints.startsWith('[') ? JSON.parse(keyPoints) : keyPoints.split('|').filter(Boolean))
          : Array.isArray(keyPoints) ? keyPoints : [];
      }
    } catch (e) {
      // If parsing fails, treat as single string
      parsedKeyPoints = [keyPoints].filter(Boolean);
    }

    try {
      if (examples) {
        parsedExamples = typeof examples === 'string'
          ? (examples.startsWith('[') ? JSON.parse(examples) : examples.split('|').filter(Boolean))
          : Array.isArray(examples) ? examples : [];
      }
    } catch (e) {
      parsedExamples = [examples].filter(Boolean);
    }

    const result = await getBestVideoForTopic(
      topicTitle.trim(),
      description || '',
      parsedKeyPoints,
      parsedExamples
    );

    return res.json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error('Error recommending video:', error);
    return res.status(500).json({ 
      success: false,
      error: 'Failed to fetch recommended video',
      message: error.message 
    });
  }
}

/**
 * GET /api/videos/recommend (with authentication)
 * Same as above but requires authentication
 */
async function recommendVideoAuth(req, res) {
  // VerifyToken middleware should have set req.user
  return recommendVideo(req, res);
}

module.exports = {
  recommendVideo,
  recommendVideoAuth
};


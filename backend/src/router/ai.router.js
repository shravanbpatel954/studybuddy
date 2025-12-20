const express = require('express');
const router = express.Router();
const { verifyToken } = require('../utils/jwt');
const { apiLimiter, strictLimiter } = require('../middleware/rateLimiter');
const { sanitizeInput } = require('../middleware/validation');
const { callGitHubChat } = require('../utils/githubModelsClient');

// Format the response to be more readable
const formatResponse = (text) => {
  // Remove excessive newlines
  let formatted = text.replace(/\n{3,}/g, '\n\n');
  
  // Split into sections for better readability
  const sections = formatted.split(/(?=###|\d\.)/);
  
  // Format each section
  formatted = sections.map(section => section.trim()).join('\n\n');
  
  return formatted;
};

// Structured prompt for better responses
const createPrompt = (query) => `
As a knowledgeable tutor, please explain this concept clearly and concisely:

${query}

Format your response as follows:
1. Definition (1-2 sentences)
2. Detailed Explanation (2-3 paragraphs)
3. Example(s) if applicable
4. Key Points (bullet points)

Keep the response focused and easy to read.
`;

// AI Doubt Solver endpoint
router.post('/solve-doubt', verifyToken, strictLimiter, sanitizeInput, async (req, res) => {
  try {
    // Check if API key is configured
    const apiKey = process.env.GITHUB_PAT || process.env.GEMINI_API_DOUBTSOLVER;
    if (!apiKey) {
      console.error('GITHUB_PAT (or GEMINI_API_DOUBTSOLVER) is not set');
      return res.status(500).json({
        success: false,
        error: 'AI service is not configured. Please set GITHUB_PAT environment variable.',
        details: 'Missing API key'
      });
    }

    // Get the query from request body
    const { query } = req.body;
    if (!query) {
      return res.status(400).json({
        success: false,
        error: 'Please provide a question'
      });
    }

    // Generate AI response using GitHub Models API
    console.log('[AI API CALLED]', 'ai.router.solve-doubt', {
      timestamp: new Date().toISOString(),
      userId: req?.user?._id
    });
    const prompt = createPrompt(query);
    const rawAnswer = await callGitHubChat(prompt, "You are a knowledgeable tutor. Provide clear, concise explanations.");
    
    if (!rawAnswer) {
      throw new Error('Empty response from AI model');
    }
    
    // Format the response
    const formattedAnswer = formatResponse(rawAnswer);

    // Send the response with optional HTML formatting
    res.json({
      success: true,
      response: formattedAnswer
    });

  } catch (error) {
    console.error('AI Error:', error);
    console.error('Error details:', {
      message: error.message,
      name: error.name,
      code: error.code
    });
    
    // Provide more specific error messages
    let errorMessage = 'Failed to process your question';
    let statusCode = 500;
    
    if (error.message?.includes('quota') || error.message?.includes('429') || error.message?.includes('RESOURCE_EXHAUSTED') || error.message?.includes('Too Many Requests')) {
      errorMessage = 'API quota exceeded. You have exceeded your current quota. Please check your plan and billing details, or try again later.';
      statusCode = 429;
    } else if (error.message?.includes('Invalid API key') || error.message?.includes('401') || error.message?.includes('Unauthorized')) {
      errorMessage = 'Invalid API key. Please check your GITHUB_PAT configuration.';
      statusCode = 401;
    } else if (error.message?.includes('network') || error.message?.includes('timeout') || error.message?.includes('ECONNREFUSED')) {
      errorMessage = 'Network error. Please check your internet connection and try again.';
      statusCode = 503;
    } else if (error.message) {
      errorMessage = error.message;
    }
    
    res.status(statusCode).json({
      success: false,
      error: errorMessage,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Health check endpoint
router.get('/health', (req, res) => {
  const apiKey = process.env.GITHUB_PAT || process.env.GEMINI_API_DOUBTSOLVER;
  res.json({
    success: true,
    hasApiKey: !!apiKey,
    service: 'AI Doubt Solver',
    timestamp: new Date().toISOString()
  });
});

// Test connection endpoint
router.get('/test', verifyToken, async (req, res) => {
  try {
    const apiKey = process.env.GITHUB_PAT || process.env.GEMINI_API_DOUBTSOLVER;
    if (!apiKey) {
      return res.status(500).json({
        success: false,
        error: 'GITHUB_PAT is not set'
      });
    }

    const testQuery = "What is 2+2?";
    const prompt = createPrompt(testQuery);
    const response = await callGitHubChat(prompt, "You are a helpful tutor.");
    
    res.json({
      success: true,
      message: 'AI service is working',
      sampleResponse: response.substring(0, 100) + '...'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'AI service test failed',
      details: error.message
    });
  }
});

module.exports = router;

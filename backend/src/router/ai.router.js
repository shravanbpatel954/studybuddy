const express = require('express');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const router = express.Router();

// Initialize the AI model
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_DOUBTSOLVER);
const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

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
router.post('/solve-doubt', async (req, res) => {
  try {
    // Get the query from request body
    const { query } = req.body;
    if (!query) {
      return res.status(400).json({
        success: false,
        error: 'Please provide a question'
      });
    }

    // Generate AI response
    const prompt = createPrompt(query);
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const rawAnswer = response.text();
    
    // Format the response
    const formattedAnswer = formatResponse(rawAnswer);

    // Send the response with optional HTML formatting
    res.json({
      success: true,
      response: formattedAnswer
    });

  } catch (error) {
    console.error('AI Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process your question',
      details: error.message
    });
  }
});

// Test endpoint to verify API key
router.get('/test', async (req, res) => {
  try {
    const result = await model.generateContent('Say "Hello, I am working!"');
    const response = await result.response;
    res.json({ 
      success: true,
      message: response.text()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'AI test failed',
      details: error.message
    });
  }
});

module.exports = router;

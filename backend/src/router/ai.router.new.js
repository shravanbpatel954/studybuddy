const express = require('express');
const { GoogleGenAI } = require('@google/genai');
const router = express.Router();

function handleAIRequest(req, res) {
    const ai = new GoogleGenAI(process.env.GEMINI_API_DOUBTSOLVER);
    const query = req.body.query;

    if (!query) {
        res.status(400).json({ error: 'Please provide a question.' });
        return;
    }

    ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: query
    })
    .then(response => {
        res.json({ response: response.text });
    })
    .catch(error => {
        console.error('AI Error:', error);
        res.status(500).json({ error: error.message });
    });
}

router.post('/solve-doubt', handleAIRequest);

module.exports = router;
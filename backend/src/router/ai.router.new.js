const express = require('express');
const router = express.Router();
const { callGitHubChat } = require('../utils/githubModelsClient');

function handleAIRequest(req, res) {
    const query = req.body.query;

    if (!query) {
        res.status(400).json({ error: 'Please provide a question.' });
        return;
    }

    console.log('[AI API CALLED]', 'ai.router.new.solve-doubt', {
        timestamp: new Date().toISOString(),
        userId: req?.user?._id
    });

    callGitHubChat(query, "You are a helpful AI tutor. Provide clear, detailed explanations.")
        .then(response => {
            res.json({ response: response });
        })
        .catch(error => {
            console.error('AI Error:', error);
            res.status(500).json({ error: error.message });
        });
}

router.post('/solve-doubt', handleAIRequest);

module.exports = router;

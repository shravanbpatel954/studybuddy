const { solveAcademicDoubt } = require('../utils/doubtSolverClient');
require('dotenv').config();

// AI Doubt Solver controller
const AiController = {
    solveDoubt: async (req, res) => {
        try {
            console.log('Received doubt query:', req.body);
            const { query } = req.body;
            console.log('[AI API CALLED]', 'AiController.solveDoubt', {
                timestamp: new Date().toISOString(),
                userId: req?.user?._id
            });
            
            if (!query) {
                console.log('Query missing in request');
                return res.status(400).json({ 
                    success: false, 
                    message: 'Query is required' 
                });
            }

            const answer = await solveAcademicDoubt(query);

            return res.status(200).json({
                success: true,
                response: answer
            });

        } catch (error) {
            console.error('AI Doubt Solver Error:', error);
            console.error('Error stack:', error.stack);
            
            // Send a more specific error message
            let errorMessage = 'Error processing your question';
            if (error.message.includes('API key')) {
                errorMessage = 'AI service configuration error';
            } else if (error.message.includes('network')) {
                errorMessage = 'Network error while contacting AI service';
            }

            return res.status(500).json({
                success: false,
                message: errorMessage,
                error: error.message
            });
        }
    }
};

module.exports = AiController;
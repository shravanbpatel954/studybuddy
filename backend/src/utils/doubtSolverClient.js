const { callGitHubChat } = require('./githubModelsClient');

async function solveAcademicDoubt(query) {
    try {
        console.log('[AI API CALLED]', 'solveAcademicDoubt', {
            timestamp: new Date().toISOString()
        });

        const prompt = `As an educational AI tutor, please help solve this academic doubt or question:

Question: ${query}

Please provide:
1. A clear, detailed explanation
2. Key points or concepts involved
3. Examples if relevant
4. Additional resources or related topics to explore

Response format:
- Use clear language suitable for students
- Break down complex concepts
- Highlight important points`;

        const response = await callGitHubChat(prompt, "You are an expert educational AI tutor. Provide clear, detailed explanations suitable for students.");
        return response;

    } catch (error) {
        console.error('Doubt Solver Error:', error);
        throw error;
    }
}

module.exports = {
    solveAcademicDoubt
};

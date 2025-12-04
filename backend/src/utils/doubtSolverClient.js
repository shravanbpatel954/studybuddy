const { GoogleGenerativeAI } = require('@google/generative-ai');

let doubtSolverClient = null;

async function getDoubtSolverClient() {
    if (doubtSolverClient) return doubtSolverClient;

    const apiKey = process.env.GEMINI_API_DOUBTSOLVER;
    if (!apiKey) {
        throw new Error('GEMINI_API_DOUBTSOLVER key is not set in environment variables');
    }

    doubtSolverClient = new GoogleGenerativeAI(apiKey);
    return doubtSolverClient;
}

async function solveAcademicDoubt(query) {
    try {
        const client = await getDoubtSolverClient();
        const model = client.getGenerativeModel({ model: "gemini-pro" });

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

        const result = await model.generateContent(prompt);
        const response = await result.response;
        return response.text();

    } catch (error) {
        console.error('Doubt Solver Error:', error);
        throw error;
    }
}

module.exports = {
    solveAcademicDoubt
};
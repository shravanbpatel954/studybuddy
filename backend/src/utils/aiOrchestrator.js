const githubClient = require('./githubModelsClient');

// ⚠️ CRITICAL: GEMINI IS COMPLETELY REMOVED FROM CONTENT GENERATION
// This orchestrator uses ONLY GitHub Models (GPT-4o-mini via GitHub PAT)
// If you see Gemini errors, STOP the backend and restart from the CORRECT directory:
// C:\Users\shrav\OneDrive\Desktop\Study-Budy-main\studybudylatest1\studybuddylatest3\backend

// Prevent any accidental Gemini import
if (typeof require !== 'undefined') {
    try {
        // This will throw if geminiClient is somehow imported
        const testGemini = require.cache[require.resolve('./geminiClient')];
        if (testGemini) {
            console.error('[AI Orchestrator] ❌ ERROR: geminiClient should NOT be imported!');
            console.error('[AI Orchestrator] ❌ This means old code is running. Restart from correct directory!');
        }
    } catch (e) {
        // Good - geminiClient is not imported
    }
}

// Log on module load to confirm correct version
console.log('[AI Orchestrator] ✅ Initialized - Using ONLY GitHub Models (GPT-4o-mini) for all content generation');
console.log('[AI Orchestrator] ✅ Gemini has been completely removed from content generation');
console.log('[AI Orchestrator] ✅ If you see Gemini errors, the backend is running from WRONG directory!');

// Use only GitHub Models (GPT-4o-mini via GitHub PAT) for all content generation
async function generateTextSmart(prompt, options = {}, moduleId = null, subsectionId = null, difficulty = null, userId = null, purpose = 'general') {
    if (!process.env.GITHUB_PAT) {
        throw new Error('GITHUB_PAT is not set in environment variables. Please configure GitHub PAT for content generation.');
    }

    try {
        return await githubClient.generateText(prompt, options, moduleId, subsectionId, difficulty, userId);
    } catch (err) {
        console.error('[AI Orchestrator] GitHub Models generateText failed:', err.message);
        throw err;
    }
}

// Wrapper for structured module/section generation - uses GitHub Models only
async function generateStructuredContentSmart(text, moduleId = null, subsectionId = null, difficulty = null, userId = null) {
    if (!process.env.GITHUB_PAT) {
        throw new Error('GITHUB_PAT is not set in environment variables. Please configure GitHub PAT for content generation.');
    }

    try {
        return await githubClient.generateStructuredContent(text, moduleId, subsectionId, difficulty, userId);
    } catch (err) {
        console.error('[AI Orchestrator] GitHub Models generateStructuredContent failed:', err.message);
        throw err;
    }
}

// Streaming version used when creating modules with progress events - uses GitHub Models only
async function generateStructuredContentStreamSmart(text, sendEvent, moduleId = null, subsectionId = null, difficulty = null, userId = null) {
    if (!process.env.GITHUB_PAT) {
        throw new Error('GITHUB_PAT is not set in environment variables. Please configure GitHub PAT for content generation.');
    }

    try {
        console.log('[AI Orchestrator] Calling GitHub Models generateStructuredContentStream (NO GEMINI FALLBACK)');
        return await githubClient.generateStructuredContentStream(text, sendEvent, moduleId, subsectionId, difficulty, userId);
    } catch (err) {
        console.error('[AI Orchestrator] ❌ GitHub Models generateStructuredContentStream failed:', err.message);
        console.error('[AI Orchestrator] ❌ NO FALLBACK AVAILABLE - This is expected if GitHub quota is exceeded');
        throw err;
    }
}

module.exports = {
    generateTextSmart,
    generateStructuredContentSmart,
    generateStructuredContentStreamSmart,
};



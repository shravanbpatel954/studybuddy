const { GoogleGenerativeAI } = require('@google/generative-ai');

// Initialize lazily to avoid throwing at module import time when env vars are missing
// Try multiple model names in order of preference
// Note: Some API keys may be configured for specific models (e.g., gemini-2.5-flash)
const MODEL_NAMES = [
    'gemini-2.5-flash',  // User's API key may be configured for this model
    'gemini-1.5-flash',  // Fast, efficient model
    'gemini-1.5-pro',    // More capable model
    'gemini-pro'         // Fallback to older model
];
let genAI = null;
let lastApiKey = null; // Track API key to detect changes

// Global configuration for more reliable JSON output
const DEFAULT_CONFIG = {
    temperature: 0.1,  // Lower temperature for more deterministic output
    maxOutputTokens: 4096,  // Reduced token limit to avoid processing delays
    topK: 1,          // Further constrain output
    topP: 0.1,        // More focused on highest probability tokens
};

// Constants for retry behavior
const MAX_ATTEMPTS = 4;
const BASE_DELAY_MS = 600; // base delay for exponential backoff

// Helper: sleep for ms milliseconds
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Helper: decide whether an error is retryable (transient service errors)
function isRetryableError(err) {
    if (!err) return false;
    const msg = (err.message || '').toLowerCase();
    // Common transient signals: 429, 503, rate limit, overloaded, timeout, network fetch failure
    if (err.status === 429 || err.status === 503) return true;
    if (msg.includes('rate limit') || msg.includes('overloaded') || 
        msg.includes('service unavailable') || msg.includes('timeout') || 
        msg.includes('temporar')) return true;
    if (msg.includes('fetch') && msg.includes('error')) return true;
    return false;
}

// Helper: check if error is a quota/quota exceeded error (should try next model, not retry same model)
function isQuotaError(err) {
    if (!err) return false;
    const msg = (err.message || '').toLowerCase();
    const status = err.status || err.statusCode;
    
    // Check status code first (429 = Too Many Requests / Quota Exceeded)
    if (status === 429) return true;
    
    // Check error message for quota-related keywords
    if (msg.includes('quota') || 
        msg.includes('quota exceeded') || 
        msg.includes('resource_exhausted') || 
        msg.includes('429') ||
        msg.includes('too many requests') ||
        msg.includes('rate limit') ||
        msg.includes('free tier limit') ||
        msg.includes('exceeded your current quota')) {
        return true;
    }
    
    return false;
}

// Reset client (useful when quota is hit and you want to try with a new key)
function resetClient() {
    genAI = null;
    lastApiKey = null;
    console.log('[Gemini Client] Client reset - will reinitialize on next call');
}

async function ensureClient() {
    // Try GEMINI_API first, then fallback to GEMINI_API_DOUBTSOLVER (for compatibility)
    const apiKey = process.env.GEMINI_API || process.env.GEMINI_API_DOUBTSOLVER;
    if (!apiKey) {
        const err = new Error('GEMINI_API or GEMINI_API_DOUBTSOLVER key is not set in environment variables');
        err.code = 'NO_GEMINI_KEY';
        throw err;
    }

    // Validate API key format (Gemini keys usually start with "AIza")
    if (apiKey.length < 20) {
        throw new Error(`Invalid Gemini API key format. Key appears too short (${apiKey.length} chars). Gemini keys are typically 39+ characters.`);
    }

    // Reset client if API key changed (allows hot-reloading new keys)
    if (genAI && lastApiKey !== apiKey) {
        console.log('[Gemini Client] API key changed, resetting client...');
        genAI = null;
        lastApiKey = null;
    }

    if (genAI) return genAI;

    const keyPreview = apiKey.length > 14 
        ? apiKey.substring(0, 10) + '...' + apiKey.substring(apiKey.length - 4)
        : apiKey.substring(0, 6) + '...';
    console.log('[Gemini Client] Initializing with API key:', keyPreview, `(length: ${apiKey.length})`);
    lastApiKey = apiKey;
    
    try {
        genAI = new GoogleGenerativeAI(apiKey);
    } catch (e) {
        throw new Error(`Failed to initialize Gemini client: ${e.message}. Please check your API key format.`);
    }

    // Test each model name and use the first one that works
    const modelErrors = [];
    for (const modelName of MODEL_NAMES) {
        try {
            const model = genAI.getGenerativeModel({ model: modelName });
            console.log(`[Gemini Client] Testing model: ${modelName}...`);
            const testResult = await model.generateContent({ 
                contents: [{ role: 'user', parts: [{ text: 'test' }] }],
                generationConfig: {
                    maxOutputTokens: 10 // Minimal test
                }
            });
            if (testResult && testResult.response) {
                console.log(`✅ Using Gemini model: ${modelName}`);
                return genAI;
            }
        } catch (e) {
            const errorMsg = e.message || String(e);
            const errorStatus = e.status || e.statusCode || 'N/A';
            modelErrors.push(`${modelName}: ${errorMsg} (status: ${errorStatus})`);
            console.warn(`⚠️ Model ${modelName} failed:`, errorMsg);
            
            // If it's an auth error (401/403), don't try other models - key is invalid
            if (e.status === 401 || e.status === 403 || errorMsg.includes('API key') || errorMsg.includes('authentication')) {
                throw new Error(`Invalid Gemini API key. Error: ${errorMsg}. Please check your GEMINI_API key in .env file.`);
            }
            
            // If it's a quota error, continue to next model
            if (isQuotaError(e)) {
                console.warn(`⚠️ Quota exceeded for ${modelName}, trying next model...`);
                continue;
            }
            
            // For other errors, continue to try next model
            continue;
        }
    }

    // If we get here, all models failed
    const errorDetails = modelErrors.length > 0 
        ? `\nModel errors:\n${modelErrors.map(e => `  - ${e}`).join('\n')}`
        : '';
    throw new Error(`No working Gemini models found. Please check API key and model availability.${errorDetails}`);
}

// Helper: Try to parse JSON with cleaning and handle truncation
function tryParseJson(str) {
    if (!str || typeof str !== 'string') return null;
    
    // First try cleaning markdown and code blocks
    let cleaned = str.replace(/```json\s*|\s*```/g, '');
    
    // Find the outermost JSON object
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (jsonMatch) cleaned = jsonMatch[0];
    
    // Clean up quotes and whitespace
    cleaned = cleaned.replace(/[\u201C\u201D]/g, '"')
                    .replace(/[\u2018\u2019]/g, "'")
                    .replace(/\s+/g, ' ')
                    .trim();
    
    try {
        // First try parsing as is
        return JSON.parse(cleaned);
    } catch (e1) {
        try {
            // If that fails and we detect truncation, try to repair the JSON
            if (cleaned.includes('..."') || cleaned.includes('...[') || cleaned.includes('...')) {
                // Find the last complete property
                const lastValidBrace = cleaned.lastIndexOf('}');
                if (lastValidBrace > 0) {
                    // Attempt to close any open structures
                    let partial = cleaned.substring(0, lastValidBrace + 1);
                    const openBraces = (partial.match(/\{/g) || []).length;
                    const closeBraces = (partial.match(/\}/g) || []).length;
                    const openBrackets = (partial.match(/\[/g) || []).length;
                    const closeBrackets = (partial.match(/\]/g) || []).length;
                    
                    // Add missing closing braces/brackets
                    while (closeBrackets < openBrackets) {
                        partial += ']';
                    }
                    while (closeBraces < openBraces) {
                        partial += '}';
                    }
                    
                    return JSON.parse(partial);
                }
            }
        } catch (e2) {
            console.warn('Failed to repair truncated JSON:', e2.message);
        }
        return null;
    }
}

async function generateStructuredContent(text) {
    if (!text || typeof text !== 'string') {
        throw new Error('Text required for structuring');
    }

    try {
        // First get high level structure
        const structurePrompt = `Analyze this text and create a basic chapter outline. Return ONLY a JSON object with this format:
{
    "subject": "Main subject",
    "chapters": [
        {
            "id": "1",
            "name": "Chapter name",
            "difficulty": "beginner"
        }
    ]
}

Text to analyze:
"""
${text}
"""`;

        const genAIClient = await ensureClient();
        const model = genAIClient.getGenerativeModel({ model: MODEL_NAMES[0] });

        // Get basic structure first
        console.log('[AI API CALLED]', 'generateStructuredContent.structure', {
            timestamp: new Date().toISOString(),
        });
        console.log('[AI API CALLED]', 'generateStructuredContentStream.structure', {
            timestamp: new Date().toISOString(),
        });
        const structureResult = await model.generateContent({
            contents: [{ role: 'user', parts: [{ text: structurePrompt }] }],
            generationConfig: {
                ...DEFAULT_CONFIG,
                temperature: 0.1,
                maxOutputTokens: 2048
            }
        });

        const structureText = await structureResult.response.text();
        console.log('Structure response:', structureText);
        
        const structure = tryParseJson(structureText);
        if (!structure || !structure.chapters) {
            throw new Error('Failed to generate basic structure');
        }

        // Now get details for each chapter sequentially
        const detailedChapters = [];
        for (const chapter of structure.chapters) {
            const detailPrompt = `For chapter ${chapter.id} "${chapter.name}" create this exact JSON structure:
{
    "id": "${chapter.id}",
    "name": "${chapter.name}",
    "difficulty": "beginner",
    "sections": [
        {
            "id": "${chapter.id}.1",
            "name": "Section name",
            "difficulty": "beginner",
            "subsections": [
                {
                    "id": "${chapter.id}.1.1",
                    "name": "Subsection name",
                    "type": "concept",
                    "content": {
                        "description": "Brief description (under 50 words)",
                        "key_points": ["Point 1", "Point 2"],
                        "examples": ["Example 1"],
                        "difficulty": "beginner"
                    }
                }
            ]
        }
    ]
}

Requirements:
1. Only 2 sections per chapter maximum
2. Only 1-2 subsections per section
3. Keep descriptions under 50 words
4. Return valid JSON only

Context:
"""
${text}
"""`;

            // Get chapter details with retries
            let chapterDetail = null;
            for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
                try {
                    console.log('[AI API CALLED]', 'generateStructuredContent.detail', {
                        timestamp: new Date().toISOString(),
                    });
                    console.log('[AI API CALLED]', 'generateStructuredContentStream.detail', {
                        timestamp: new Date().toISOString(),
                    });
                    const detailResult = await model.generateContent({
                        contents: [{ role: 'user', parts: [{ text: detailPrompt }] }],
                        generationConfig: {
                            ...DEFAULT_CONFIG,
                            temperature: 0.1
                        }
                    });

                    const detailText = await detailResult.response.text();
                    console.log(`Chapter ${chapter.id} response:`, detailText.substring(0, 100) + '...');
                    
                    chapterDetail = tryParseJson(detailText);
                    if (chapterDetail && chapterDetail.sections) {
                        detailedChapters.push(chapterDetail);
                        break;
                    }

                    if (attempt < MAX_ATTEMPTS) {
                        const backoff = Math.round(BASE_DELAY_MS * Math.pow(2, attempt - 1));
                        await sleep(backoff + Math.round(Math.random() * backoff * 0.3));
                    }
                } catch (e) {
                    console.warn(`Chapter ${chapter.id} attempt ${attempt} failed:`, e.message);
                    if (attempt < MAX_ATTEMPTS && isRetryableError(e)) {
                        const backoff = Math.round(BASE_DELAY_MS * Math.pow(2, attempt - 1));
                        await sleep(backoff + Math.round(Math.random() * backoff * 0.3));
                        continue;
                    }
                    throw e;
                }
            }
            
            if (!chapterDetail) {
                throw new Error(`Failed to generate details for chapter ${chapter.id}`);
            }
        }

        return {
            subject: structure.subject,
            chapters: detailedChapters
        };
    } catch (error) {
        console.error('Content generation error:', {
            message: error.message,
            status: error.status,
            statusText: error.statusText,
            stack: error.stack
        });

        throw new Error('Failed to generate content: ' + (error.message || error));
    }
}

async function generateText(prompt, options = {}) {
    if (!prompt || typeof prompt !== 'string') {
        throw new Error('Prompt required for text generation');
    }

    try {
        const client = await ensureClient();
        const generationConfig = {
            ...DEFAULT_CONFIG,
            ...options,
        };

        let lastError = null;
        for (const modelName of MODEL_NAMES) {
            const model = client.getGenerativeModel({ model: modelName });
            
            for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
                try {
                    console.log('[AI API CALLED]', 'generateText', {
                        timestamp: new Date().toISOString(),
                        modelName,
                    });
                    const result = await model.generateContent({
                        contents: [{ role: 'user', parts: [{ text: prompt }] }],
                        generationConfig,
                    });

                    if (!result || !result.response) {
                        throw new Error('Empty response from model');
                    }

                    if (result.response && typeof result.response.text === 'function') {
                        const maybe = result.response.text();
                        return maybe instanceof Promise ? await maybe : maybe;
                    }

                    if (typeof result.response === 'string') return result.response;
                    if (result.outputText) return result.outputText;

                    return JSON.stringify(result.response);

                } catch (err) {
                    lastError = err;
                    // If quota error, don't retry this model - try next model instead
                    if (isQuotaError(err)) {
                        console.warn(`⚠️ Quota exceeded for model ${modelName}, trying next model...`);
                        break; // Break inner loop to try next model
                    }
                    if (isRetryableError(err) && attempt < MAX_ATTEMPTS) {
                        const backoff = Math.round(BASE_DELAY_MS * Math.pow(2, attempt - 1));
                        const jitter = Math.round(Math.random() * (backoff * 0.3));
                        const wait = backoff + jitter;
                        console.warn(`Transient Gemini error (model=${modelName}) attempt ${attempt}/${MAX_ATTEMPTS}: ${err.message}. Retrying in ${wait}ms.`);
                        await sleep(wait);
                        continue;
                    }
                    console.warn(`Gemini model ${modelName} failed:`, err.message);
                    break;
                }
            }
        }

        throw lastError || new Error('All models and retries failed');
    } catch (error) {
        console.error('Text generation error:', {
            message: error.message,
            status: error.status,
            statusText: error.statusText,
            stack: error.stack
        });

        // Handle quota/rate limit errors specifically
        if (error.status === 429 || error.message?.includes('quota') || error.message?.includes('RESOURCE_EXHAUSTED') || error.message?.includes('429')) {
            const quotaError = new Error('API quota exceeded. You have reached the free tier limit. Please try again in a few minutes.');
            quotaError.status = 429;
            quotaError.code = 'QUOTA_EXCEEDED';
            throw quotaError;
        }

        if (error.name === 'TypeError' && error.message && error.message.includes('fetch')) {
            throw new Error('Network error: Failed to connect to Gemini API');
        }

        if (error.status) {
            throw new Error('Gemini API error: ' + error.status + ' - ' + (error.statusText || error.message));
        }

        throw new Error('Failed to generate text: ' + (error.message || error));
    }
}

// Streaming version of generateStructuredContent
async function generateStructuredContentStream(text, sendEvent) {
    if (!text || typeof text !== 'string') {
        throw new Error('Text required for structuring');
    }

    try {
        const structurePrompt = `Analyze this text and create a basic chapter outline. Return ONLY a JSON object with this format:
{
    "subject": "Main subject",
    "chapters": [
        {
            "id": "1",
            "name": "Chapter name",
            "difficulty": "beginner"
        }
    ]
}

Text to analyze:
"""
${text}
"""`;

        const genAIClient = await ensureClient();
        const model = genAIClient.getGenerativeModel({ model: MODEL_NAMES[0] });

        sendEvent('chapter_structure', { message: 'Analyzing content structure...' });
        const structureResult = await model.generateContent({
            contents: [{ role: 'user', parts: [{ text: structurePrompt }] }],
            generationConfig: {
                ...DEFAULT_CONFIG,
                temperature: 0.1,
                maxOutputTokens: 2048
            }
        });

        const structureText = await structureResult.response.text();
        const structure = tryParseJson(structureText);
        if (!structure || !structure.chapters) {
            throw new Error('Failed to generate basic structure');
        }

        sendEvent('chapters_found', { count: structure.chapters.length });

        const detailedChapters = [];
        for (let i = 0; i < structure.chapters.length; i++) {
            const chapter = structure.chapters[i];
            sendEvent('chapter_progress', { 
                current: i + 1, 
                total: structure.chapters.length,
                chapter: chapter.name 
            });

            const detailPrompt = `For chapter ${chapter.id} "${chapter.name}" create this exact JSON structure:
{
    "id": "${chapter.id}",
    "name": "${chapter.name}",
    "difficulty": "beginner",
    "sections": [
        {
            "id": "${chapter.id}.1",
            "name": "Section name",
            "difficulty": "beginner",
            "subsections": [
                {
                    "id": "${chapter.id}.1.1",
                    "name": "Subsection name",
                    "type": "concept",
                    "content": {
                        "description": "Brief description (under 50 words)",
                        "key_points": ["Point 1", "Point 2"],
                        "examples": ["Example 1"],
                        "difficulty": "beginner"
                    }
                }
            ]
        }
    ]
}

Requirements:
1. Only 2 sections per chapter maximum
2. Only 1-2 subsections per section
3. Keep descriptions under 50 words
4. Return valid JSON only

Context:
"""
${text}
"""`;

            let chapterDetail = null;
            for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
                try {
                    const detailResult = await model.generateContent({
                        contents: [{ role: 'user', parts: [{ text: detailPrompt }] }],
                        generationConfig: {
                            ...DEFAULT_CONFIG,
                            temperature: 0.1
                        }
                    });

                    const detailText = await detailResult.response.text();
                    chapterDetail = tryParseJson(detailText);
                    if (chapterDetail && chapterDetail.sections) {
                        detailedChapters.push(chapterDetail);
                        break;
                    }

                    if (attempt < MAX_ATTEMPTS) {
                        const backoff = Math.round(BASE_DELAY_MS * Math.pow(2, attempt - 1));
                        await sleep(backoff + Math.round(Math.random() * backoff * 0.3));
                    }
                } catch (e) {
                    console.warn(`Chapter ${chapter.id} attempt ${attempt} failed:`, e.message);
                    if (attempt < MAX_ATTEMPTS && isRetryableError(e)) {
                        const backoff = Math.round(BASE_DELAY_MS * Math.pow(2, attempt - 1));
                        await sleep(backoff + Math.round(Math.random() * backoff * 0.3));
                        continue;
                    }
                    throw e;
                }
            }
            
            if (!chapterDetail) {
                throw new Error(`Failed to generate details for chapter ${chapter.id}`);
            }
        }

        return {
            subject: structure.subject,
            chapters: detailedChapters
        };
    } catch (error) {
        console.error('Content generation error:', {
            message: error.message,
            status: error.status,
            statusText: error.statusText,
            stack: error.stack
        });

        throw new Error('Failed to generate content: ' + (error.message || error));
    }
}

module.exports = {
    generateStructuredContent,
    generateStructuredContentStream,
    generateText,
    resetClient // Export reset function for manual client reset if needed
};
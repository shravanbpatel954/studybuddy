const axios = require('axios');

// GitHub Models API Configuration
const API_URL = "https://models.github.ai/inference/chat/completions";
const MODEL_NAME = "openai/gpt-4o-mini";

// Global configuration for more reliable JSON output
const DEFAULT_CONFIG = {
    temperature: 0.1,  // Lower temperature for more deterministic output
    max_tokens: 4096,  // Token limit
};

// Constants for retry behavior
const MAX_ATTEMPTS = 4;
const BASE_DELAY_MS = 600; // base delay for exponential backoff

// Helper: sleep for ms milliseconds
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Helper: decide whether an error is retryable (transient service errors)
// NOTE: 429 (rate limit) is NOT retryable immediately - we should respect rate limits
function isRetryableError(err) {
    if (!err) return false;
    const msg = (err.message || '').toLowerCase();
    const status = err.response?.status || err.status;
    
    // DO NOT retry on 429 - rate limits should be respected
    if (status === 429) return false;
    
    // Retry on other transient errors: 503, timeout, network issues
    if (status === 503) return true;
    if (msg.includes('overloaded') || 
        msg.includes('service unavailable') || msg.includes('timeout') || 
        msg.includes('temporar')) return true;
    if (msg.includes('network') || msg.includes('fetch') || msg.includes('econnrefused')) return true;
    return false;
}

// Get API key from environment (GitHub Models PAT ONLY)
function getApiKey() {
    const apiKey = process.env.GITHUB_PAT;
    if (!apiKey) {
        console.error('[GitHub Models] GITHUB_PAT not found in environment variables');
        console.error('[GitHub Models] Available env vars:', Object.keys(process.env).filter(k => k.includes('GITHUB') || k.includes('PAT')));
        const err = new Error('GITHUB_PAT is not set in environment variables');
        err.code = 'NO_API_KEY';
        throw err;
    }
    
    // Log that we found the key (but don't log the full key for security)
    if (!getApiKey._logged) {
        console.log('[GitHub Models] ✅ API key loaded:', apiKey.substring(0, 15) + '...' + apiKey.substring(apiKey.length - 4));
        getApiKey._logged = true;
    }
    
    // Log that we found the key (but don't log the full key for security)
    if (!getApiKey._logged) {
        console.log('[GitHub Models] API key loaded:', apiKey.substring(0, 15) + '...' + apiKey.substring(apiKey.length - 4));
        getApiKey._logged = true;
    }
    
    return apiKey;
}

// Get headers for API requests
function getHeaders() {
    const apiKey = getApiKey();
    return {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
    };
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

// Main function to call GitHub Models API (matches Streamlit implementation)
async function callGitHubChat(userContent, systemContent = "You are a helpful AI assistant.", options = {}) {
    const apiKey = getApiKey();
    if (!apiKey) {
        throw new Error('GITHUB_PAT is not set in environment variables');
    }

    const headers = {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
    };

    const config = {
        ...DEFAULT_CONFIG,
        ...options,
    };

    const data = {
        model: MODEL_NAME,
        messages: [
            { role: "system", content: systemContent },
            { role: "user", content: userContent }
        ],
        temperature: config.temperature,
        max_tokens: config.max_tokens || config.maxOutputTokens || 4096,
    };

    try {
        console.log('[GitHub Models] Calling API:', {
            model: MODEL_NAME,
            url: API_URL,
            hasApiKey: !!apiKey,
            apiKeyPrefix: apiKey ? apiKey.substring(0, 10) + '...' : 'none'
        });

        const response = await axios.post(API_URL, data, { headers });
        
        // Check for successful response (2xx)
        if (response.status >= 200 && response.status < 300) {
            if (response.data && response.data.choices && response.data.choices.length > 0) {
                const content = response.data.choices[0].message.content;
                console.log('[GitHub Models] Success:', {
                    status: response.status,
                    contentLength: content?.length || 0
                });
                return content;
            }
            throw new Error('Empty response from GitHub Models API: no choices in response');
        }
        
        // Non-2xx status
        const msg = response.data?.error?.message || response.data?.message || `HTTP ${response.status}`;
        throw new Error(`GitHub Models API error: ${response.status} - ${msg}`);
    } catch (error) {
        // Handle axios errors
        if (error.response) {
            const status = error.response.status;
            const errorData = error.response.data;
            const errorMsg = errorData?.error?.message || errorData?.message || error.message;
            
            console.error('[GitHub Models] API Error:', {
                status,
                error: errorMsg,
                data: errorData,
                fullResponse: JSON.stringify(errorData, null, 2)
            });
            
            // Handle 429 rate limit errors - DO NOT retry immediately
            if (status === 429) {
                // Check for Retry-After header (can be in various formats)
                let retryAfter = error.response?.headers?.['retry-after'] || 
                                error.response?.headers?.['Retry-After'];
                
                // Also check in error data (some APIs put it there)
                if (!retryAfter && errorData) {
                    retryAfter = errorData.retry_after || errorData.retryAfter || errorData.retry_after_seconds;
                }
                
                // Parse retry-after if it's a string
                if (retryAfter && typeof retryAfter === 'string') {
                    retryAfter = parseInt(retryAfter, 10);
                }
                
                // If retry-after is unreasonably long (> 1 hour), don't show it
                let errorMessage = `GitHub Models API rate limit exceeded (429).`;
                if (retryAfter && retryAfter > 0 && retryAfter < 3600) {
                    const minutes = Math.ceil(retryAfter / 60);
                    errorMessage += ` Please retry after ${minutes} minute(s).`;
                } else if (retryAfter && retryAfter >= 3600) {
                    const hours = Math.ceil(retryAfter / 3600);
                    errorMessage += ` Rate limit will reset in approximately ${hours} hour(s).`;
                } else {
                    errorMessage += ` Please try again in a few minutes.`;
                }
                
                console.error('[GitHub Models] Rate limit details:', {
                    status: 429,
                    retryAfter,
                    headers: error.response?.headers,
                    errorData
                });
                
                const quotaError = new Error(errorMessage);
                quotaError.status = 429;
                quotaError.code = 'QUOTA_EXCEEDED';
                quotaError.retryAfter = retryAfter;
                throw quotaError;
            }
            
            // Handle authentication errors
            if (status === 401 || status === 403) {
                const authError = new Error(`GitHub Models API authentication failed (${status}). Please check your GITHUB_PAT. Error: ${errorMsg}`);
                authError.status = status;
                authError.code = 'AUTH_ERROR';
                throw authError;
            }
            
            // For all other errors, pass through the actual error message
            const apiError = new Error(`GitHub Models API error (${status}): ${errorMsg}`);
            apiError.status = status;
            apiError.originalError = errorData;
            throw apiError;
        }
        
        // Handle network/other errors
        console.error('[GitHub Models] Request Error:', {
            message: error.message,
            code: error.code,
            stack: error.stack
        });
        
        if (error.message?.includes('network') || error.message?.includes('ECONNREFUSED') || error.code === 'ECONNREFUSED') {
            throw new Error('Network error: Failed to connect to GitHub Models API. Please check your internet connection.');
        }
        
        throw error;
    }
}

async function generateStructuredContent(text, moduleId = null, subsectionId = null, difficulty = null, userId = null) {
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

        console.log('[AI API CALLED]', 'generateStructuredContent.structure', {
            timestamp: new Date().toISOString(),
            moduleId,
            subsectionId,
            difficulty,
            userId
        });

        const structureText = await callGitHubChat(structurePrompt, "You are an expert educational content analyzer. Return only valid JSON.", {
            temperature: 0.1,
            max_tokens: 2048
        });

        console.log('Structure response:', structureText);
        
        const structure = tryParseJson(structureText);
        if (!structure || !structure.chapters) {
            throw new Error('Failed to generate basic structure');
        }

        // Limit the number of chapters to process to avoid hitting rate limits
        // Process max 5 chapters at a time to stay within API limits
        const MAX_CHAPTERS_PER_REQUEST = 5;
        const chaptersToProcess = structure.chapters.slice(0, MAX_CHAPTERS_PER_REQUEST);
        
        if (structure.chapters.length > MAX_CHAPTERS_PER_REQUEST) {
            console.warn(`[GitHub Models] Limiting to ${MAX_CHAPTERS_PER_REQUEST} chapters to avoid rate limits. Total chapters: ${structure.chapters.length}`);
        }

        // Now get details for each chapter sequentially
        // Add a small delay between requests to avoid rate limits
        const detailedChapters = [];
        for (let i = 0; i < chaptersToProcess.length; i++) {
            const chapter = chaptersToProcess[i];
            
            // Add delay between chapter requests to avoid rate limits (except for first chapter)
            // Increased delay to 2 seconds to be more conservative with rate limits
            if (i > 0) {
                console.log(`[GitHub Models] Waiting 2 seconds before processing chapter ${i + 1}/${structure.chapters.length}...`);
                await sleep(2000); // 2 second delay between chapter requests
            }
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
                        moduleId,
                        subsectionId,
                        difficulty,
                        userId,
                        chapterId: chapter.id
                    });

                    const detailText = await callGitHubChat(detailPrompt, "You are an expert educational content analyzer. Return only valid JSON.", {
                        temperature: 0.1,
                        max_tokens: 2048
                    });

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
            stack: error.stack
        });

        throw new Error('Failed to generate content: ' + (error.message || error));
    }
}

async function generateText(prompt, options = {}, moduleId = null, subsectionId = null, difficulty = null, userId = null) {
    if (!prompt || typeof prompt !== 'string') {
        throw new Error('Prompt required for text generation');
    }

    try {
        const config = {
            ...DEFAULT_CONFIG,
            ...options,
        };

        let lastError = null;
        for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
            try {
                console.log('[AI API CALLED]', 'generateText', {
                    timestamp: new Date().toISOString(),
                    moduleId,
                    subsectionId,
                    difficulty,
                    userId
                });

                const response = await callGitHubChat(prompt, "You are a helpful AI assistant. Return only the requested content.", config);

                if (!response || typeof response !== 'string') {
                    throw new Error('Empty response from model');
                }

                return response;

            } catch (err) {
                lastError = err;
                if (isRetryableError(err) && attempt < MAX_ATTEMPTS) {
                    const backoff = Math.round(BASE_DELAY_MS * Math.pow(2, attempt - 1));
                    const jitter = Math.round(Math.random() * (backoff * 0.3));
                    const wait = backoff + jitter;
                    console.warn(`Transient GitHub Models error attempt ${attempt}/${MAX_ATTEMPTS}: ${err.message}. Retrying in ${wait}ms.`);
                    await sleep(wait);
                    continue;
                }
                throw err;
            }
        }

        throw lastError || new Error('All retries failed');
    } catch (error) {
        console.error('Text generation error:', {
            message: error.message,
            status: error.status,
            stack: error.stack
        });

        // Only treat as quota error if status is explicitly 429
        // Don't check error message text as it might be misleading
        if (error.status === 429) {
            const quotaError = new Error(`GitHub Models API rate limit exceeded (429). Please try again in a few minutes. Original error: ${error.message}`);
            quotaError.status = 429;
            quotaError.code = 'QUOTA_EXCEEDED';
            throw quotaError;
        }

        if (error.message?.includes('network') || error.message?.includes('fetch') || error.message?.includes('econnrefused')) {
            throw new Error('Network error: Failed to connect to GitHub Models API');
        }

        if (error.status) {
            throw new Error('GitHub Models API error: ' + error.status + ' - ' + (error.message || 'Unknown error'));
        }

        throw new Error('Failed to generate text: ' + (error.message || error));
    }
}

// Streaming version of generateStructuredContent
async function generateStructuredContentStream(text, sendEvent, moduleId = null, subsectionId = null, difficulty = null, userId = null) {
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

        sendEvent('chapter_structure', { message: 'Analyzing content structure...' });
        
        const structureText = await callGitHubChat(structurePrompt, "You are an expert educational content analyzer. Return only valid JSON.", {
            temperature: 0.1,
            max_tokens: 2048
        });

        const structure = tryParseJson(structureText);
        if (!structure || !structure.chapters) {
            throw new Error('Failed to generate basic structure');
        }

        // Limit the number of chapters to process to avoid hitting rate limits
        // Process max 5 chapters at a time to stay within API limits
        const MAX_CHAPTERS_PER_REQUEST = 5;
        const chaptersToProcess = structure.chapters.slice(0, MAX_CHAPTERS_PER_REQUEST);
        
        if (structure.chapters.length > MAX_CHAPTERS_PER_REQUEST) {
            console.warn(`[GitHub Models] Limiting to ${MAX_CHAPTERS_PER_REQUEST} chapters to avoid rate limits. Total chapters: ${structure.chapters.length}`);
            sendEvent('warning', { message: `Processing first ${MAX_CHAPTERS_PER_REQUEST} of ${structure.chapters.length} chapters to avoid rate limits` });
        }

        sendEvent('chapters_found', { count: chaptersToProcess.length });

        const detailedChapters = [];
        for (let i = 0; i < chaptersToProcess.length; i++) {
            const chapter = chaptersToProcess[i];
            
            // Add delay between chapter requests to avoid rate limits (except for first chapter)
            // Increased delay to 2 seconds to be more conservative with rate limits
            if (i > 0) {
                console.log(`[GitHub Models] Waiting 2 seconds before processing chapter ${i + 1}/${structure.chapters.length}...`);
                await sleep(2000); // 2 second delay between chapter requests
            }
            
            sendEvent('chapter_progress', { 
                current: i + 1, 
                total: chaptersToProcess.length,
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
                    const detailText = await callGitHubChat(detailPrompt, "You are an expert educational content analyzer. Return only valid JSON.", {
                        temperature: 0.1,
                        max_tokens: 2048
                    });

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
            stack: error.stack
        });

        throw new Error('Failed to generate content: ' + (error.message || error));
    }
}

// Test function to verify API key and connection
async function testConnection() {
    try {
        const apiKey = getApiKey();
        if (!apiKey) {
            return { success: false, error: 'GITHUB_PAT is not set in environment variables' };
        }

        console.log('[GitHub Models] Testing connection...');
        const testResponse = await callGitHubChat(
            'Say "Hello" if you can read this.',
            'You are a helpful AI assistant.',
            { temperature: 0.1, max_tokens: 50 }
        );

        return {
            success: true,
            message: 'GitHub Models API connection successful',
            response: testResponse
        };
    } catch (error) {
        console.error('[GitHub Models] Connection test failed:', error);
        return {
            success: false,
            error: error.message,
            status: error.status,
            code: error.code
        };
    }
}

module.exports = {
    generateStructuredContent,
    generateStructuredContentStream,
    generateText,
    callGitHubChat,
    testConnection
};


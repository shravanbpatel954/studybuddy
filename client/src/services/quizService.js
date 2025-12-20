const API_BASE = process.env.REACT_APP_API_BASE?.replace('/api/v1', '') || process.env.REACT_APP_API || 'https://studybuddy-backend-i649.onrender.com';

// Check if quiz exists, generate if needed, then fetch next question
export async function fetchNext(payload) {
    const token = localStorage.getItem('token') || '';
    const { subsectionId, difficulty = 'beginner' } = payload || {};

    if (!token || !subsectionId) {
        // Fallback for unauthenticated/test mode
        const path = '/api/v1/auth/quiz/test';
        const url = `${API_BASE}${path}`;
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        return res.json();
    }

    // Step 1: Check if quiz exists
    const checkUrl = `${API_BASE}/api/v1/modules/quizzes/${subsectionId}?difficulty=${difficulty}`;
    const headers = { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token };
    
    try {
        const checkRes = await fetch(checkUrl, { method: 'GET', headers });
        const checkData = await checkRes.json();
        
        if (checkData && checkData.success && checkData.exists && checkData.quiz) {
            // Quiz exists - fetch next question
            const nextUrl = `${API_BASE}/api/v1/auth/quiz/next`;
            const nextRes = await fetch(nextUrl, {
                method: 'POST',
                headers,
                body: JSON.stringify({ subsectionId, difficulty })
            });
            return await nextRes.json();
        } else {
            // Quiz doesn't exist - return needsGeneration flag
            return { 
                success: false, 
                needsGeneration: true,
                error: 'Quiz not found. Please generate quiz first.'
            };
        }
    } catch (e) {
        console.error('Failed to check/fetch quiz:', e);
        return { success: false, error: e.message };
    }
}

// ⚡ FAST: Generate quiz with parallel fetching - questions appear instantly
export async function generateQuizFast(subsectionId, difficulty = 'beginner', topic = '', content = '') {
    const token = localStorage.getItem('token') || '';
    if (!token) {
        return { success: false, error: 'Not authenticated' };
    }

    const API_BASE = process.env.REACT_APP_API_BASE?.replace('/api/v1', '') || process.env.REACT_APP_API || 'https://studybuddy-backend-i649.onrender.com';
    const questionCount = 5;
    const questions = [];
    const errors = [];

    // Create parallel fetch promises
    const promises = [];
    for (let i = 0; i < questionCount; i++) {
        const url = `${API_BASE}/api/v1/modules/generateOneMCQ?topic=${encodeURIComponent(topic)}&difficulty=${difficulty}&index=${i}&subsectionId=${subsectionId}`;
        const headers = {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + token
        };

        promises.push(
            fetch(url, {
                method: 'POST',
                headers,
                body: JSON.stringify({ content: content.substring(0, 1500) })
            })
            .then(async (res) => {
                if (!res.ok) {
                    const errorData = await res.json();
                    throw new Error(errorData.error || 'Failed to generate MCQ');
                }
                return res.json();
            })
            .then((data) => {
                if (data.success && data.question) {
                    return {
                        question: data.question,
                        options: data.options,
                        correctAnswer: data.correctAnswer,
                        explanation: data.explanation,
                        id: data.id,
                        index: data.index,
                        subsectionId: subsectionId,
                        generatedAt: data.generatedAt
                    };
                }
                throw new Error('Invalid response format');
            })
            .catch(async (error) => {
                // Retry once if failed
                if (!error.retried) {
                    try {
                        const retryUrl = `${url}&retry=true`;
                        const retryRes = await fetch(retryUrl, {
                            method: 'POST',
                            headers,
                            body: JSON.stringify({ content: content.substring(0, 1500) })
                        });
                        if (retryRes.ok) {
                            const retryData = await retryRes.json();
                            if (retryData.success && retryData.question) {
                                return {
                                    question: retryData.question,
                                    options: retryData.options,
                                    correctAnswer: retryData.correctAnswer,
                                    explanation: retryData.explanation,
                                    id: retryData.id,
                                    index: retryData.index,
                                    subsectionId: subsectionId,
                                    generatedAt: retryData.generatedAt
                                };
                            }
                        }
                    } catch (retryError) {
                        console.error(`Retry failed for question ${i}:`, retryError);
                    }
                }
                errors.push({ index: i, error: error.message });
                return null;
            })
        );
    }

    // Process questions as they arrive
    const questionMap = new Map();
    promises.forEach(async (promise, i) => {
        try {
            const question = await promise;
            if (question) {
                questionMap.set(i, question);
                // Questions are added to array as they arrive
                questions.push(question);
            }
        } catch (error) {
            console.error(`Error processing question ${i}:`, error);
        }
    });

    // Wait for all promises
    await Promise.all(promises);

    // Sort questions by index
    questions.sort((a, b) => (a.index || 0) - (b.index || 0));

    if (questions.length === 0) {
        return { success: false, error: 'Failed to generate any questions', errors };
    }

    return {
        success: true,
        quiz: {
            questions: questions,
            totalQuestions: questions.length,
            difficulty: difficulty
        },
        errors: errors.length > 0 ? errors : null
    };
}

// Generate quiz with streaming - questions are streamed one at a time
export async function generateQuiz(subsectionId, difficulty = 'beginner', onProgress = null) {
    const token = localStorage.getItem('token') || '';
    if (!token) {
        return { success: false, error: 'Not authenticated' };
    }

    const url = `${API_BASE}/api/v1/auth/modules/quizzes/${subsectionId}/stream`;
    const headers = { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token };

    try {
        const res = await fetch(url, {
            method: 'POST',
            headers,
            body: JSON.stringify({ difficulty })
        });

        if (!res.ok) {
            const errorData = await res.json();
            return { success: false, error: errorData.error || 'Failed to generate quiz' };
        }

        // Handle SSE stream
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let quiz = null;

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    try {
                        const data = JSON.parse(line.slice(6));
                        
                        // Handle different event types
                        if (data.type === 'question' && data.question) {
                            // Question is ready - stream it immediately
                            if (onProgress) {
                                onProgress({
                                    type: 'question',
                                    question: data.question,
                                    index: data.index,
                                    total: data.total,
                                    message: data.message
                                });
                            }
                        } else if (data.type === 'progress') {
                            // Progress update
                            if (onProgress) {
                                onProgress({
                                    type: 'progress',
                                    step: data.step,
                                    message: data.message,
                                    current: data.current,
                                    total: data.total
                                });
                            }
                        } else if (data.type === 'complete') {
                            // Quiz generation complete
                            quiz = data.quiz;
                            if (onProgress) {
                                onProgress({
                                    type: 'complete',
                                    quiz: data.quiz,
                                    exists: data.exists,
                                    message: data.message
                                });
                            }
                            return { success: true, quiz: data.quiz, exists: data.exists };
                        } else if (data.type === 'error') {
                            return { success: false, error: data.message };
                        } else if (onProgress) {
                            // Pass through any other events
                            onProgress(data);
                        }
                    } catch (e) {
                        console.warn('Error parsing SSE data:', e);
                    }
                }
            }
        }

        // If we have a quiz but didn't get complete event, return it
        if (quiz) {
            return { success: true, quiz, exists: true };
        }

        return { success: false, error: 'Stream ended without completion' };
    } catch (e) {
        console.error('Failed to generate quiz:', e);
        return { success: false, error: e.message };
    }
}

// Generate a rich flashcard-style explanation for a given MCQ using backend AI orchestrator.
export async function generateFlashcardExplanation(payload) {
    const token = localStorage.getItem('token') || '';
    const headers = {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': 'Bearer ' + token } : {})
    };

    const url = `${API_BASE}/api/v1/auth/quiz/explain`;

    try {
        const res = await fetch(url, {
            method: 'POST',
            headers,
            body: JSON.stringify(payload || {})
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.error || `Failed to generate flashcard explanation (${res.status})`);
        }

        return await res.json();
    } catch (e) {
        console.error('generateFlashcardExplanation failed:', e);
        return { success: false, error: e.message };
    }
}

export async function postAnswer(payload) {
    const token = localStorage.getItem('token') || '';
    const path = token ? '/api/v1/auth/quiz/answer' : '/api/v1/auth/quiz/test/answer';
    const url = `${API_BASE}${path}`;
    const headers = {
        'Content-Type': 'application/json'
    };
    if (token) headers['Authorization'] = 'Bearer ' + token;

    const res = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload)
    });
    return res.json();
}

export async function attemptComplete(payload) {
    const token = localStorage.getItem('token') || '';
    const path = token ? '/api/v1/auth/quiz/attempt' : '/api/v1/auth/quiz/test/answer';
    const url = `${API_BASE}${path}`;
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = 'Bearer ' + token;

    const res = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload)
    });
    return res.json();
}

// NEW: Dedicated function to save quiz attempt (always saves, no skipping)
export async function saveQuizAttempt(payload) {
    const token = localStorage.getItem('token') || '';
    if (!token) {
        return { success: false, error: 'Not authenticated' };
    }
    
    const url = `${API_BASE}/api/quiz/attempts`;
    const headers = { 
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token
    };

    try {
        const res = await fetch(url, {
            method: 'POST',
            headers,
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        console.log('[saveQuizAttempt] Response:', data);
        return data;
    } catch (error) {
        console.error('[saveQuizAttempt] Error:', error);
        return { success: false, error: error.message };
    }
}

export async function getAttempts(subsectionId) {
    const token = localStorage.getItem('token') || '';
    const url = `${API_BASE}/api/v1/auth/quiz/attempts/${subsectionId}`;
    const headers = {
        'Content-Type': 'application/json',
        'Authorization': token ? 'Bearer ' + token : ''
    };

    try {
        const res = await fetch(url, { method: 'GET', headers });
        return res.json();
    } catch (err) {
        console.error('Failed to get attempts:', err);
        return { success: false, error: err.message };
    }
}

export async function getProgress(subsectionId) {
    const token = localStorage.getItem('token') || '';
    const url = `${API_BASE}/api/v1/auth/quiz/progress/${subsectionId}`;
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = 'Bearer ' + token;

    try {
        const res = await fetch(url, { method: 'GET', headers });
        return await res.json();
    } catch (err) {
        console.error('getProgress failed', err);
        return { success: false, error: err.message };
    }
}

export async function getYouTubeShorts(topic) {
    const token = localStorage.getItem('token') || '';
    // NOTE: Backend routes live at /api/quiz/* (not /api/v1/auth/*)
    const url = `${API_BASE}/api/quiz/youtube-shorts?topic=${encodeURIComponent(topic)}`;
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = 'Bearer ' + token;

    try {
        const res = await fetch(url, { method: 'GET', headers });
        return await res.json();
    } catch (err) {
        console.error('getYouTubeShorts failed', err);
        return { success: false, error: err.message };
    }
}

// Get regular YouTube videos (server-side filtered for relevance)
export async function getYouTubeVideos(topic, maxResults = 4) {
    const token = localStorage.getItem('token') || '';
    // NOTE: Backend routes live at /api/quiz/* (not /api/v1/auth/*)
    const url = `${API_BASE}/api/quiz/youtube-videos?topic=${encodeURIComponent(topic)}&max=${maxResults}`;
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = 'Bearer ' + token;

    try {
        const res = await fetch(url, { method: 'GET', headers });
        return await res.json();
    } catch (err) {
        console.error('getYouTubeVideos failed', err);
        return { success: false, error: err.message };
    }
}

// Get stored quiz for user/subsection/difficulty
export async function getStoredQuiz(subsectionId, difficulty = 'beginner') {
    const token = localStorage.getItem('token') || '';
    const url = `${API_BASE}/api/v1/modules/quizzes/${subsectionId}?difficulty=${difficulty}`;
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = 'Bearer ' + token;

    try {
        const res = await fetch(url, { method: 'GET', headers });
        const data = await res.json();
        if (data && data.success && data.exists && data.quiz) {
            return { success: true, quiz: data.quiz, exists: true };
        }
        return { success: true, quiz: null, exists: false };
    } catch (err) {
        console.error('getStoredQuiz failed', err);
        return { success: false, quiz: null, exists: false, error: err.message };
    }
}

// Session Management Functions
export async function createSession(subsectionId) {
    const token = localStorage.getItem('token') || '';
    const url = `${API_BASE}/api/v1/auth/quiz/session/start`;
    const headers = {
        'Content-Type': 'application/json',
        'Authorization': token ? 'Bearer ' + token : ''
    };

    try {
        const res = await fetch(url, {
            method: 'POST',
            headers,
            body: JSON.stringify({ subsectionId })
        });
        return res.json();
    } catch (err) {
        console.error('Failed to create session:', err);
        return { success: false, error: err.message };
    }
}

export async function updateSession(sessionId, sessionData) {
    const token = localStorage.getItem('token') || '';
    const url = `${API_BASE}/api/v1/auth/quiz/session/${sessionId}`;
    const headers = {
        'Content-Type': 'application/json',
        'Authorization': token ? 'Bearer ' + token : ''
    };

    try {
        const res = await fetch(url, {
            method: 'PUT',
            headers,
            body: JSON.stringify(sessionData)
        });
        return res.json();
    } catch (err) {
        console.error('Failed to update session:', err);
        return { success: false, error: err.message };
    }
}

export async function getSession(sessionId) {
    const token = localStorage.getItem('token') || '';
    const url = `${API_BASE}/api/v1/auth/quiz/session/${sessionId}`;
    const headers = {
        'Content-Type': 'application/json',
        'Authorization': token ? 'Bearer ' + token : ''
    };

    try {
        const res = await fetch(url, { method: 'GET', headers });
        return res.json();
    } catch (err) {
        console.error('Failed to get session:', err);
        return { success: false, error: err.message };
    }
}

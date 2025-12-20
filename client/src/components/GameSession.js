import React, { useState, useEffect } from 'react';
import QuizCard from './QuizCard';
import Flashcard from './Flashcard';
import { fetchNext, postAnswer, attemptComplete, getProgress, generateQuiz, getAttempts, saveQuizAttempt, generateFlashcardExplanation } from '../services/quizService';
import { jsPDF } from 'jspdf';
import { Download, Eye, X } from 'lucide-react';
import './GameSession.css';
// We'll emit a global event so the dashboard can refresh points when the server awards them

export default function GameSession({ subsectionId }) {
    // FORCE RE-RENDER: Key-based remount to fix stale UI
    const [uiKey, setUiKey] = useState(0);
    
    const [gameState, setGameState] = useState({
        currentChallenge: null,
        challengeType: null, // 'battle' (mcq) or 'flashcard' or null
        roundIndex: 0,
        totalRounds: 5,
        pendingFlashcard: null,
        mcqQueue: [],
        queueIndex: 0,
        correctCount: 0,
        totalMcqTimeMs: 0,
        overallStartAt: null, // track when the first MCQ was started
        showFinal: false,
        pointsEarnedThisQuiz: 0
    });
    const [selectedInterest, setSelectedInterest] = useState('ai');
    const [isGenerating, setIsGenerating] = useState(false);
    const [generationProgress, setGenerationProgress] = useState({ current: 0, total: 5, message: '' });
    const [showCompletionPopup, setShowCompletionPopup] = useState(false);
    const [completionData, setCompletionData] = useState(null);
    const [showAttemptsModal, setShowAttemptsModal] = useState(false);
    const [quizAttempts, setQuizAttempts] = useState([]);
    const [showPointsBubble, setShowPointsBubble] = useState(false);
    const [pointsBubbleValue, setPointsBubbleValue] = useState(0);
    const difficultyLevels = ['beginner', 'intermediate', 'advanced'];
    const progressData = gameState.progress || {};
    const currentDifficulty = progressData.difficulty || 'beginner';
    const currentLevelIndex = Math.max(0, difficultyLevels.indexOf(currentDifficulty));
    const nextDifficulty = currentLevelIndex >= difficultyLevels.length - 1 ? null : difficultyLevels[currentLevelIndex + 1];
    
    // Combine attempts from both progress and quizAttempts state
    const progressAttempts = Array.isArray(progressData.attempts) ? progressData.attempts : [];
    const stateAttempts = Array.isArray(quizAttempts) ? quizAttempts : [];
    
    // Use stateAttempts first (most up-to-date), then fallback to progressAttempts
    // Deduplicate by date/id
    const attemptsMap = new Map();
    
    // Add stateAttempts first (most recent)
    stateAttempts.forEach(attempt => {
        const dateKey = attempt.date ? new Date(attempt.date).getTime() : 
                       (attempt.completedAt ? new Date(attempt.completedAt).getTime() : Date.now());
        const idKey = attempt._id || `${dateKey}-${attempt.score}-${attempt.totalQuestions}`;
        if (!attemptsMap.has(idKey)) {
            attemptsMap.set(idKey, attempt);
        }
    });
    
    // Add progressAttempts (fallback)
    progressAttempts.forEach(attempt => {
        const dateKey = attempt.date ? new Date(attempt.date).getTime() : 
                       (attempt.completedAt ? new Date(attempt.completedAt).getTime() : Date.now());
        const idKey = attempt._id || `${dateKey}-${attempt.score}-${attempt.totalQuestions}`;
        if (!attemptsMap.has(idKey)) {
            attemptsMap.set(idKey, attempt);
        }
    });
    
    const allAttempts = Array.from(attemptsMap.values());
    
    // Sort by date (newest first)
    allAttempts.sort((a, b) => {
        const dateA = a.date ? new Date(a.date).getTime() : (a.completedAt ? new Date(a.completedAt).getTime() : 0);
        const dateB = b.date ? new Date(b.date).getTime() : (b.completedAt ? new Date(b.completedAt).getTime() : 0);
        return dateB - dateA;
    });
    
    // Debug logging
    if (allAttempts.length > 0) {
        console.log('[Attempts Display] Total attempts:', allAttempts.length, {
            stateAttempts: stateAttempts.length,
            progressAttempts: progressAttempts.length,
            allAttempts: allAttempts.map(a => ({ date: a.date, score: a.score, total: a.totalQuestions }))
        });
    }
    
    const attemptsList = allAttempts;
    const attemptsPreview = attemptsList.slice(0, 3);
    const totalAttempts = attemptsList.length;
    const formatDifficulty = (level = '') => level.charAt(0).toUpperCase() + level.slice(1);
    const levelMessage = nextDifficulty
        ? `Get all questions correct to advance to ${formatDifficulty(nextDifficulty)} level`
        : "You're at the highest level! Keep up the great work!";

    // Reset session when subsection changes so each section is treated separately
    // Fetch user progress and reset session when subsection changes
    React.useEffect(() => {
        const resetGameState = () => {
            setGameState(prev => ({
                ...prev,
                currentChallenge: null,
                challengeType: null,
                roundIndex: 0,
                totalRounds: 5,
                pendingFlashcard: null,
                mcqQueue: [],
                queueIndex: 0,
                correctCount: 0,
                totalMcqTimeMs: 0,
                overallStartAt: null,
                showFinal: false,
                attemptSubmitted: false,
                usedQuestionIds: [], // Track used questions to prevent repetition
                pointsEarnedThisQuiz: 0
            }));
        };

        const loadProgress = async () => {
            if (!subsectionId) return;
            try {
                const res = await getProgress(subsectionId);
                if (res && res.success) {
                    // normalize attempts: ensure array and sort by date desc so newest appears first
                    const attempts = Array.isArray(res.progress.attempts) ? res.progress.attempts.slice() : [];
                    attempts.sort((a, b) => {
                        const dateA = a.date ? new Date(a.date).getTime() : (a.completedAt ? new Date(a.completedAt).getTime() : 0);
                        const dateB = b.date ? new Date(b.date).getTime() : (b.completedAt ? new Date(b.completedAt).getTime() : 0);
                        return dateB - dateA;
                    });
                    const normalized = { ...res.progress, attempts };
                    setGameState(prev => ({ ...prev, difficulty: normalized.difficulty || prev.difficulty, progress: normalized }));
                    // Also update quizAttempts state
                    if (attempts.length > 0) {
                        console.log('[Load Progress] ✅ Setting quizAttempts:', attempts.length, 'attempts');
                        setQuizAttempts(attempts);
                    } else {
                        console.log('[Load Progress] No attempts found');
                    }
                }
            } catch (err) {
                console.warn('Failed to load progress', err);
            }
        };

        resetGameState();
        loadProgress();
        loadAttempts(); // Also load attempts when subsection changes
    }, [subsectionId]);

    // (no extra ready state needed)

    // 🚀 Start quiz with streaming - questions appear immediately as they're generated
    const startQuizWithStreaming = async () => {
        if (!subsectionId) return;
        
        setIsGenerating(true);
        setGenerationProgress({ current: 0, total: 5, message: 'Starting quiz generation...' });
        
        const difficulty = gameState.progress?.difficulty || 'beginner';
        
        try {
            // Use the reliable streaming endpoint instead of parallel fetching
            const result = await generateQuiz(subsectionId, difficulty, (event) => {
                if (event.type === 'question' && event.question) {
                    // Question is ready - add it to queue and show IMMEDIATELY
                    const question = { ...event.question, subsectionId };
                    
                    setGenerationProgress({
                        current: event.index + 1,
                        total: event.total,
                        message: `Question ${event.index + 1} ready!`
                    });
                    
                    // Show first question IMMEDIATELY - don't wait for others
                    setGameState(prev => {
                        const newQueue = prev.mcqQueue || [];
                        const questionExists = newQueue.some(q => q.id === question.id);
                        if (!questionExists) {
                            newQueue.push(question);
                        }
                        const sortedQueue = newQueue.sort((a, b) => (a.index || 0) - (b.index || 0));
                        
                        // Show first question immediately
                        if (sortedQueue.length === 1 && !prev.currentChallenge) {
                            setIsGenerating(false); // Hide loading once first question shows
                            return {
                                ...prev,
                                mcqQueue: sortedQueue,
                                queueIndex: 0,
                                roundIndex: 0,
                                totalRounds: event.total,
                                currentChallenge: question,
                                challengeType: 'battle',
                                overallStartAt: Date.now(),
                                questionShownAt: Date.now(),
                                attemptedQuestions: [],
                                showFinal: false,
                                correctCount: 0,
                                totalMcqTimeMs: 0
                            };
                        } else {
                            // Update queue for subsequent questions
                            return {
                                ...prev,
                                mcqQueue: sortedQueue,
                                totalRounds: event.total
                            };
                        }
                    });
                } else if (event.type === 'progress') {
                    setGenerationProgress({
                        current: event.current || 0,
                        total: event.total || 5,
                        message: event.message || 'Generating questions...'
                    });
                } else if (event.type === 'complete') {
                    setIsGenerating(false);
                    setGenerationProgress({ current: 5, total: 5, message: 'All questions ready!' });
                    
                    // Ensure all questions are in the queue
                    if (event.quiz && event.quiz.questions) {
                        const allQuestions = event.quiz.questions.map(q => ({ ...q, subsectionId }));
                        setGameState(prev => ({
                            ...prev,
                            mcqQueue: allQuestions,
                            totalRounds: allQuestions.length
                        }));
                    }
                } else if (event.type === 'error') {
                    setIsGenerating(false);
                    // Parse error message for user-friendly display
                    const errorMsg = event.message || 'Unknown error';
                    let userFriendlyMsg = 'Failed to generate quiz';
                    let retryTime = null;
                    
                    // Check for quota/rate limit errors
                    if (errorMsg.includes('429') || errorMsg.includes('quota') || errorMsg.includes('Too Many Requests')) {
                        userFriendlyMsg = 'API quota exceeded. You have reached the free tier limit.';
                        // Extract retry time if available
                        const retryMatch = errorMsg.match(/retry in ([\d.]+)s/i);
                        if (retryMatch) {
                            retryTime = Math.ceil(parseFloat(retryMatch[1]));
                            userFriendlyMsg += ` Please try again in ${retryTime} seconds.`;
                        } else {
                            userFriendlyMsg += ' Please try again in a few minutes.';
                        }
                    } else if (errorMsg.includes('API key') || errorMsg.includes('401')) {
                        userFriendlyMsg = 'API configuration error. Please contact support.';
                    } else if (errorMsg.includes('Network') || errorMsg.includes('fetch')) {
                        userFriendlyMsg = 'Network error. Please check your internet connection and try again.';
                    } else {
                        userFriendlyMsg = `Failed to generate quiz: ${errorMsg.substring(0, 100)}`;
                    }
                    
                    // Show user-friendly error message
                    alert(userFriendlyMsg);
                }
            });
            
            // If streaming completed but we didn't get questions through events
            if (result && result.success && result.quiz && result.quiz.questions) {
                const allQuestions = result.quiz.questions.map(q => ({ ...q, subsectionId }));
                setGameState(prev => {
                    if (!prev.currentChallenge && allQuestions.length > 0) {
                        return {
                            ...prev,
                            mcqQueue: allQuestions,
                            queueIndex: 0,
                            roundIndex: 0,
                            totalRounds: allQuestions.length,
                            currentChallenge: allQuestions[0],
                            challengeType: 'battle',
                            overallStartAt: Date.now(),
                            questionShownAt: Date.now(),
                            attemptedQuestions: [],
                            showFinal: false,
                            correctCount: 0,
                            totalMcqTimeMs: 0
                        };
                    }
                    return {
                        ...prev,
                        mcqQueue: allQuestions,
                        totalRounds: allQuestions.length
                    };
                });
                setIsGenerating(false);
            } else if (!result || !result.success) {
                setIsGenerating(false);
                // Parse error message for user-friendly display
                const errorMsg = result?.error || 'Unknown error';
                let userFriendlyMsg = 'Failed to generate quiz';
                
                // Check for quota/rate limit errors
                if (errorMsg.includes('429') || errorMsg.includes('quota') || errorMsg.includes('Too Many Requests')) {
                    userFriendlyMsg = 'API quota exceeded. You have reached the free tier limit. Please try again in a few minutes.';
                } else if (errorMsg.includes('API key') || errorMsg.includes('401')) {
                    userFriendlyMsg = 'API configuration error. Please contact support.';
                } else if (errorMsg.includes('Network') || errorMsg.includes('fetch')) {
                    userFriendlyMsg = 'Network error. Please check your internet connection and try again.';
                } else {
                    userFriendlyMsg = `Failed to generate quiz: ${errorMsg.substring(0, 100)}`;
                }
                
                alert(userFriendlyMsg);
            }
        } catch (error) {
            console.error('Error starting quiz:', error);
            setIsGenerating(false);
            // Parse error message for user-friendly display
            const errorMsg = error.message || 'Unknown error';
            let userFriendlyMsg = 'Failed to start quiz';
            
            // Check for quota/rate limit errors
            if (errorMsg.includes('429') || errorMsg.includes('quota') || errorMsg.includes('Too Many Requests')) {
                userFriendlyMsg = 'API quota exceeded. You have reached the free tier limit. Please try again in a few minutes.';
            } else if (errorMsg.includes('API key') || errorMsg.includes('401')) {
                userFriendlyMsg = 'API configuration error. Please contact support.';
            } else if (errorMsg.includes('Network') || errorMsg.includes('fetch')) {
                userFriendlyMsg = 'Network error. Please check your internet connection and try again.';
            } else {
                userFriendlyMsg = `Failed to start quiz: ${errorMsg.substring(0, 100)}`;
            }
            
            alert(userFriendlyMsg);
        }
    };

    const loadNextFromQueue = () => {
        setGameState(prev => {
            const nextIdx = (prev.queueIndex || 0);
            const next = prev.mcqQueue?.[nextIdx] || null;
            if (next) {
                return { ...prev, currentChallenge: next, challengeType: 'battle', questionShownAt: Date.now() };
            }
            return prev;
        });
    };

    const getRandomYouTubeShort = (interest = 'ai') => {
        const pool = {
            ai: [
                'https://www.youtube.com/embed/mJeNghZXtMo', // What is AI?
                'https://www.youtube.com/embed/aircAruvnKk', // Neural Networks
                'https://www.youtube.com/embed/ukzFI9rgwfU', // Machine Learning
                'https://www.youtube.com/embed/GvYYFloV0aA'  // Deep Learning
            ],
            math: [
                'https://www.youtube.com/embed/WUvTyaaNkzM', // 3Blue1Brown - Essence of Calculus
                'https://www.youtube.com/embed/fNk_zzaMoSs', // 3Blue1Brown - Linear Algebra
                'https://www.youtube.com/embed/PxCxlsl_YwY', // Statistics
                'https://www.youtube.com/embed/bR9KKKuL7Gg'  // Geometry
            ],
            science: [
                'https://www.youtube.com/embed/7WhRJV_bAiE', // Physics 
                'https://www.youtube.com/embed/FSyAehMdpyI', // Chemistry
                'https://www.youtube.com/embed/QnQe0xW_JY4', // Biology
                'https://www.youtube.com/embed/JGXi_9A__Vc'  // Earth Science
            ],
            history: [
                'https://www.youtube.com/embed/Yocja_N5s1I', // Crash Course World History
                'https://www.youtube.com/embed/3R3cvbLsbAk', // History of Science
                'https://www.youtube.com/embed/WhtuC9dp0Hk', // Ancient Civilizations
                'https://www.youtube.com/embed/J6VjPM5CeWs'  // Modern History
            ]
        };
        const list = pool[interest] || pool['ai'];
        return list[Math.floor(Math.random() * list.length)];
    };

    const handleAnswer = async (answerObj) => {
        // FIX: Correct condition check - only process answers when challengeType is 'battle'
        if (gameState.challengeType !== 'battle') {
            console.warn('[handleAnswer] Skipping - challengeType is not battle:', gameState.challengeType);
            return;
        }

        try {
            const now = Date.now();
            const questionShown = gameState.questionShownAt || now;
            const questionElapsed = Math.max(0, now - questionShown);
            const selectedAnswer = answerObj?.selectedAnswer;
            // Normalize both answers for comparison (trim, case-insensitive)
            const normalizeAnswer = (ans) => {
                if (!ans) return '';
                return String(ans).trim().toLowerCase();
            };
            const correct = normalizeAnswer(selectedAnswer) === normalizeAnswer(gameState.currentChallenge?.correctAnswer);
            const start = gameState.overallStartAt || now;
            const elapsed = Math.max(0, now - start) - (gameState.totalMcqTimeMs || 0);

            // Snapshot current question for async flashcard explanation
            const currentQuestionSnapshot = gameState.currentChallenge;

            // Send answer to backend and get verified result
            const answerResponse = await postAnswer({ 
                subsectionId, 
                correct, 
                questionId: gameState.currentChallenge?.id, 
                selectedAnswer 
            }).catch(e => {
                console.warn('postAnswer failed:', e);
                return { success: false, correct: correct }; // Fallback to frontend value
            });
            
            // Use server-verified correct value if available
            const verifiedCorrect = answerResponse?.correct !== undefined ? answerResponse.correct : correct;
            const earnedPointsNow = answerResponse?.pointsEarned || 0;
            
            // Show bubble animation for points earned
            if (earnedPointsNow > 0 && verifiedCorrect) {
                setPointsBubbleValue(earnedPointsNow);
                setShowPointsBubble(true);
                setTimeout(() => {
                    setShowPointsBubble(false);
                }, 2000);
                
                console.log(`[Points] ✅ Earned ${earnedPointsNow} points for correct answer. New total: ${answerResponse.newPointsTotal}`);
                // Dispatch event to update points display immediately
                try {
                    const event = new CustomEvent('pointsUpdated', { 
                        detail: { 
                            earned: earnedPointsNow, 
                            pointsEarned: earnedPointsNow,
                            newTotal: answerResponse.newPointsTotal 
                        },
                        bubbles: true,
                        cancelable: true
                    });
                    window.dispatchEvent(event);
                    console.log('[Points] Event dispatched:', event.detail);
                } catch (e) {
                    console.error('[Points] Failed to dispatch event:', e);
                    // Fallback: try legacy event creation
                    try {
                        const ev = document.createEvent('Event');
                        ev.initEvent('pointsUpdated', true, true);
                        ev.detail = { earned: earnedPointsNow, pointsEarned: earnedPointsNow, newTotal: answerResponse.newPointsTotal };
                        window.dispatchEvent(ev);
                        console.log('[Points] Legacy event dispatched');
                    } catch (e2) {
                        console.error('[Points] Legacy event also failed:', e2);
                    }
                }
            } else {
                console.log('[Points] No points earned:', { 
                    pointsEarned: answerResponse?.pointsEarned, 
                    verifiedCorrect,
                    answerResponse 
                });
            }
            
            // Log for debugging
            console.log('[Answer]', {
                selectedAnswer,
                correctAnswer: gameState.currentChallenge?.correctAnswer,
                frontendCorrect: correct,
                serverVerified: answerResponse?.correct,
                finalCorrect: verifiedCorrect,
                pointsEarned: answerResponse?.pointsEarned || 0
            });

            // Update game state with functional update to ensure correct count
            setGameState(prev => {
                const newCorrectCount = verifiedCorrect ? (prev.correctCount || 0) + 1 : (prev.correctCount || 0);
                console.log('[State Update]', {
                    oldCorrectCount: prev.correctCount || 0,
                    newCorrectCount,
                    verifiedCorrect
                });
                return {
                    ...prev,
                    totalMcqTimeMs: (prev.totalMcqTimeMs || 0) + elapsed,
                    correctCount: newCorrectCount,
                    pointsEarnedThisQuiz: (prev.pointsEarnedThisQuiz || 0) + earnedPointsNow,
                    attemptedQuestions: [
                        ...(prev.attemptedQuestions || []),
                        {
                            questionId: prev.currentChallenge?.id,
                            question: prev.currentChallenge?.question,
                            options: prev.currentChallenge?.options || [],
                            correctAnswer: prev.currentChallenge?.correctAnswer,
                            selectedAnswer,
                            timeMs: questionElapsed
                        }
                    ],
                    pendingFlashcard: {
                        front: prev.currentChallenge?.question || 'Review',
                        back: prev.currentChallenge?.explanation || 
                              `Answer: ${prev.currentChallenge?.correctAnswer || ''}`,
                        // Base flashcard data – will be enriched asynchronously by AI
                        question: prev.currentChallenge?.question,
                        options: prev.currentChallenge?.options || [],
                        correctAnswer: prev.currentChallenge?.correctAnswer,
                        selectedAnswer: selectedAnswer,
                        explanation: prev.currentChallenge?.explanation,
                        isCorrect: verifiedCorrect,
                        questionId: prev.currentChallenge?.id
                    }
                };
            });

            // Fire-and-forget: Request a rich flashcard-style explanation from backend AI.
            // This mirrors the AI Doubt Solver style but is scoped to the current MCQ.
            (async () => {
                try {
                    const explainPayload = {
                        subsectionId,
                        questionId: currentQuestionSnapshot?.id,
                        question: currentQuestionSnapshot?.question,
                        options: currentQuestionSnapshot?.options || [],
                        correctAnswer: currentQuestionSnapshot?.correctAnswer,
                        selectedAnswer,
                        originalExplanation: currentQuestionSnapshot?.explanation,
                        topic: currentQuestionSnapshot?.topic || currentQuestionSnapshot?.question,
                        difficulty: currentDifficulty || 'intermediate'
                    };

                    const explainRes = await generateFlashcardExplanation(explainPayload);
                    if (explainRes && explainRes.success && explainRes.flashcard) {
                        setGameState(prev => {
                            const flash = explainRes.flashcard;
                            const matchId = currentQuestionSnapshot?.id;

                            const enhanceCard = (card) => {
                                if (!card) return card;
                                if (matchId && card.questionId && card.questionId !== matchId) {
                                    return card;
                                }
                                return {
                                    ...card,
                                    explanation: flash.explanation || card.explanation,
                                    insight: flash.insight || card.insight,
                                    resources: {
                                        ...(card.resources || {}),
                                        ...(flash.resources || {})
                                    }
                                };
                            };

                            const nextState = { ...prev };
                            let changed = false;

                            // Update pending flashcard (shown after MCQ when user clicks Next)
                            if (prev.pendingFlashcard) {
                                const updatedPending = enhanceCard(prev.pendingFlashcard);
                                if (updatedPending !== prev.pendingFlashcard) {
                                    nextState.pendingFlashcard = updatedPending;
                                    changed = true;
                                }
                            }

                            // If user is already viewing the flashcard, update currentChallenge too
                            if (prev.challengeType === 'flashcard' && prev.currentChallenge) {
                                const updatedCurrent = enhanceCard(prev.currentChallenge);
                                if (updatedCurrent !== prev.currentChallenge) {
                                    nextState.currentChallenge = updatedCurrent;
                                    changed = true;
                                }
                            }

                            return changed ? nextState : prev;
                        });
                    }
                } catch (e) {
                    console.warn('[GameSession] AI flashcard explanation failed, using base explanation:', e);
                }
            })();
        } catch (error) {
            console.error('Failed to submit answer:', error);
        }
    };

    // NEW: Always save attempt - no skipping, no duplicate checks
    const submitAttempt = async (score, total) => {
        try {
            if (!subsectionId) {
                console.warn('[Submit Attempt] No subsectionId provided');
                return null;
            }
            
            // Get current state values (read directly, no state update needed)
            const currentState = gameState;
            const finalScore = currentState.correctCount || score || 0;
            const finalTotal = currentState.totalRounds || total || 0;
            const finalTimeMs = currentState.totalMcqTimeMs || 0;
            const finalAttemptedQuestions = currentState.attemptedQuestions || [];
            const finalDifficulty = currentDifficulty || 'beginner';
            const startedAt = currentState.overallStartAt || Date.now();
            
            console.log('[Submit Attempt] ✅ ALWAYS saving attempt with ALL quiz data:', { 
                subsectionId, 
                difficulty: finalDifficulty,
                score: finalScore, 
                correctAnswers: finalScore,
                total: finalTotal, 
                timeTakenSeconds: Math.round(finalTimeMs / 1000),
                attemptedQuestionsCount: finalAttemptedQuestions.length
            });
            
            // ALWAYS call the new dedicated endpoint (no skipping, no duplicate checks)
            const resp = await saveQuizAttempt({
                subsectionId,
                difficulty: finalDifficulty,
                score: finalScore,
                correctAnswers: finalScore,
                totalQuestions: finalTotal,
                timeTakenSeconds: Math.round(finalTimeMs / 1000),
                startedAt: new Date(startedAt),
                attemptedQuestions: finalAttemptedQuestions
            });
            
            console.log('[Submit Attempt] ✅ Backend response received:', resp);
            
            if (resp && resp.success) {
                console.log('[Submit Attempt] ✅ Attempt saved successfully:', resp.attempt);
                // Immediately refresh attempts after successful save
                setTimeout(() => {
                    loadAttempts();
                }, 500);
            } else {
                console.error('[Submit Attempt] ❌ Failed to save attempt:', resp);
            }
            
            return resp;
        } catch (error) {
            console.error('[Submit Attempt] ❌ Error saving attempt:', error);
            return { success: false, error: error.message };
        }
    };

    // Legacy function - now just calls submitAttempt (always saves, no checks)
    const submitAttemptIfNeeded = async (score, total) => {
        // ALWAYS submit - no "if needed" checks, no skipping
        return await submitAttempt(score, total);
    };

    // Load quiz attempts

    // Load quiz attempts
    const loadAttempts = async () => {
        if (!subsectionId) {
            console.warn('loadAttempts: No subsectionId provided');
            return;
        }
        try {
            console.log('[loadAttempts] Loading attempts for subsection:', subsectionId);
            
            // Try getAttempts first
            let attempts = [];
            try {
                const result = await getAttempts(subsectionId);
                console.log('[loadAttempts] getAttempts result:', result);
                if (result && result.success && Array.isArray(result.attempts)) {
                    attempts = result.attempts;
                    console.log('[loadAttempts] ✅ Got', attempts.length, 'attempts from getAttempts');
                }
            } catch (getAttemptsError) {
                console.warn('[loadAttempts] getAttempts failed:', getAttemptsError);
            }
            
            // Always also try getProgress as backup
            try {
                const progress = await getProgress(subsectionId);
                console.log('[loadAttempts] getProgress result:', progress);
                if (progress && progress.success && progress.progress && Array.isArray(progress.progress.attempts)) {
                    const progressAttempts = progress.progress.attempts;
                    console.log('[loadAttempts] ✅ Got', progressAttempts.length, 'attempts from getProgress');
                    
                    // Merge with existing attempts, preferring getAttempts results
                    const mergedMap = new Map();
                    attempts.forEach(a => {
                        const key = a.date ? new Date(a.date).getTime() : `${a.score}-${a.totalQuestions}`;
                        mergedMap.set(key, a);
                    });
                    progressAttempts.forEach(a => {
                        const key = a.date ? new Date(a.date).getTime() : `${a.score}-${a.totalQuestions}`;
                        if (!mergedMap.has(key)) {
                            mergedMap.set(key, a);
                        }
                    });
                    attempts = Array.from(mergedMap.values());
                }
            } catch (getProgressError) {
                console.warn('[loadAttempts] getProgress failed:', getProgressError);
            }
            
            // Sort by date (newest first)
            attempts.sort((a, b) => {
                const dateA = a.date ? new Date(a.date).getTime() : (a.completedAt ? new Date(a.completedAt).getTime() : 0);
                const dateB = b.date ? new Date(b.date).getTime() : (b.completedAt ? new Date(b.completedAt).getTime() : 0);
                return dateB - dateA;
            });
            
            console.log('[loadAttempts] ✅ Final attempts count:', attempts.length);
            if (attempts.length > 0) {
                console.log('[loadAttempts] Sample attempt:', {
                    date: attempts[0].date,
                    score: attempts[0].score,
                    total: attempts[0].totalQuestions,
                    difficulty: attempts[0].difficulty
                });
            }
            
            setQuizAttempts(attempts);
        } catch (error) {
            console.error('[loadAttempts] ❌ Failed to load attempts:', error);
            setQuizAttempts([]);
        }
    };

    // Load attempts on mount and when subsection changes
    useEffect(() => {
        if (subsectionId) {
            loadAttempts();
            // Also ensure progress is loaded
            const loadProgressAndAttempts = async () => {
                try {
                    const res = await getProgress(subsectionId);
                    if (res && res.success) {
                        const attempts = Array.isArray(res.progress.attempts) ? res.progress.attempts.slice() : [];
                        attempts.sort((a, b) => new Date(b.date || b.completedAt || 0) - new Date(a.date || a.completedAt || 0));
                        const normalized = { ...res.progress, attempts };
                        setGameState(prev => ({ ...prev, progress: normalized }));
                    }
                } catch (err) {
                    console.warn('Failed to load progress on mount:', err);
                }
            };
            loadProgressAndAttempts();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [subsectionId]);

    // Also load attempts when progress changes (after quiz completion)
    useEffect(() => {
        if (gameState.progress && gameState.progress.attempts) {
            // Update quizAttempts from progress if available
            const attempts = Array.isArray(gameState.progress.attempts) ? gameState.progress.attempts : [];
            if (attempts.length > 0) {
                console.log('[Progress Effect] Updating quizAttempts from progress:', attempts.length, 'attempts');
                setQuizAttempts(attempts);
            }
        }
    }, [gameState.progress]);
    
    // When popup closes, show session complete section and refresh attempts
    useEffect(() => {
        if (!showCompletionPopup && completionData && gameState.sessionCompleted) {
            // Popup just closed - now show session complete section
            console.log('[Popup Closed] Showing session complete section');
            setGameState(prev => ({ ...prev, showFinal: true }));
            
            // Refresh attempts one more time
            setTimeout(() => {
                loadAttempts();
                const refreshProgress = async () => {
                    try {
                        const p = await getProgress(subsectionId);
                        if (p && p.success) {
                            const attempts = Array.isArray(p.progress.attempts) ? p.progress.attempts.slice() : [];
                            attempts.sort((a, b) => new Date(b.date || b.completedAt || 0) - new Date(a.date || a.completedAt || 0));
                            const normalized = { ...p.progress, attempts };
                            setGameState(prev => ({ ...prev, progress: normalized }));
                            if (attempts.length > 0) {
                                setQuizAttempts(attempts);
                            }
                        }
                    } catch (err) {
                        console.warn('Failed to refresh progress after popup close:', err);
                    }
                };
                refreshProgress();
            }, 200);
        }
    }, [showCompletionPopup, completionData, gameState.sessionCompleted, subsectionId]);

    // Download quiz attempts as PDF
    const downloadAttemptsPDF = () => {
        if (quizAttempts.length === 0) {
            alert('No quiz attempts to download');
            return;
        }

        try {
            const doc = new jsPDF();
            const pageWidth = doc.internal.pageSize.getWidth();
            const margin = 20;
            const maxWidth = pageWidth - 2 * margin;
            let y = margin;
            const lineHeight = 7;
            const spacing = 5;

            // Title
            doc.setFontSize(18);
            doc.text('Quiz Attempts History', margin, y);
            y += lineHeight + spacing * 2;

            quizAttempts.forEach((attempt, idx) => {
                if (y > doc.internal.pageSize.getHeight() - margin - 30) {
                    doc.addPage();
                    y = margin;
                }

                // Attempt header
                doc.setFontSize(14);
                doc.setFont('helvetica', 'bold');
                doc.text(`Attempt ${idx + 1}`, margin, y);
                y += lineHeight;

                // Date
                doc.setFontSize(10);
                doc.setFont('helvetica', 'normal');
                const dateStr = new Date(attempt.date).toLocaleString();
                doc.text(`Date: ${dateStr}`, margin, y);
                y += lineHeight;

                // Score
                doc.text(`Score: ${attempt.score}/${attempt.totalQuestions}`, margin, y);
                y += lineHeight;

                // Difficulty
                doc.text(`Difficulty: ${attempt.difficulty}`, margin, y);
                y += lineHeight;

                // Time
                if (attempt.timeMs) {
                    doc.text(`Time: ${Math.round(attempt.timeMs / 1000)}s`, margin, y);
                    y += lineHeight;
                }

                y += spacing;

                // Questions
                if (attempt.attemptedQuestions && attempt.attemptedQuestions.length > 0) {
                    doc.setFontSize(11);
                    attempt.attemptedQuestions.forEach((q, qIdx) => {
                        if (y > doc.internal.pageSize.getHeight() - margin - 20) {
                            doc.addPage();
                            y = margin;
                        }

                        doc.setFont('helvetica', 'bold');
                        doc.text(`Q${qIdx + 1}: ${q.question || 'Question'}`, margin + 5, y);
                        y += lineHeight;

                        doc.setFont('helvetica', 'normal');
                        if (q.options && Array.isArray(q.options)) {
                            q.options.forEach((opt, optIdx) => {
                                const prefix = opt === q.correctAnswer ? '✓' : (opt === q.selectedAnswer ? '→' : '');
                                doc.text(`${prefix} ${String.fromCharCode(65 + optIdx)}. ${opt}`, margin + 10, y);
                                y += lineHeight;
                            });
                        }

                        doc.text(`Selected: ${q.selectedAnswer || 'N/A'}`, margin + 10, y);
                        y += lineHeight;
                        doc.text(`Correct: ${q.correctAnswer || 'N/A'}`, margin + 10, y);
                        y += spacing * 2;
                    });
                }

                y += spacing * 2;
            });

            const filename = `quiz-attempts-${subsectionId}-${Date.now()}.pdf`;
            doc.save(filename);
        } catch (error) {
            console.error('Failed to export PDF:', error);
            alert('Failed to export PDF. Please try again.');
        }
    };

    return (
        <div key={uiKey}>
            {/* Points Bubble Animation - Shows when points are earned per answer */}
            {showPointsBubble && pointsBubbleValue > 0 && (
                <div className="answer-points-bubble">
                    +{pointsBubbleValue} 🎉
                </div>
            )}
            
            {/* FORCE RENDER: Animated Completion Popup at TOP LEVEL - MUST BE VISIBLE */}
            {showCompletionPopup && completionData && (
                <div className="completion-popup-overlay" onClick={() => {
                    setShowCompletionPopup(false);
                    // Refresh attempts when popup closes
                    setTimeout(() => {
                        loadAttempts();
                        getProgress(subsectionId).then(p => {
                            if (p && p.success && Array.isArray(p.progress.attempts)) {
                                const attempts = p.progress.attempts.slice();
                                attempts.sort((a, b) => new Date(b.date || b.completedAt || 0) - new Date(a.date || a.completedAt || 0));
                                setQuizAttempts(attempts);
                            }
                        });
                    }, 100);
                }} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div className="completion-popup" onClick={(e) => e.stopPropagation()}>
                        <div className="completion-popup-content">
                            <div className="completion-icon">🎉</div>
                            <h2 className="completion-title">Congratulations!</h2>
                            <div className="completion-points">
                                <span className="points-number">
                                    +{
                                        // Always show the ACTUAL points earned this quiz:
                                        // 1) Prefer completionData.pointsEarned / points populated above
                                        // 2) Fallback to gameState.pointsEarnedThisQuiz (sum of per-question points)
                                        (completionData.pointsEarned ??
                                         completionData.points ??
                                         gameState.pointsEarnedThisQuiz ??
                                         0)
                                    }
                                </span>
                                <span className="points-label">Points Added</span>
                            </div>
                            <div className="completion-stats">
                                <div className="stat-item">
                                    <span className="stat-label">Correct</span>
                                    <span className="stat-value">{completionData.correctAnswers !== undefined ? completionData.correctAnswers : completionData.score || 0} / {completionData.total || 0}</span>
                                </div>
                                <div className="stat-item">
                                    <span className="stat-label">Level</span>
                                    <span className="stat-value">{completionData.difficulty || 'beginner'}</span>
                                </div>
                            </div>
                            <div className="completion-message">
                                <p>✅ You got {completionData.correctAnswers !== undefined ? completionData.correctAnswers : completionData.score || 0} out of {completionData.total || 0} questions correct!</p>
                            </div>
                            {completionData.promoted && (
                                <div className="promotion-badge">
                                    ⬆️ Level Up! You've been promoted to {completionData.difficulty}!
                                </div>
                            )}
                            <button 
                                className="completion-close-btn"
                                onClick={() => {
                                    setShowCompletionPopup(false);
                                    // Refresh attempts when popup closes
                                    setTimeout(() => {
                                        loadAttempts();
                                        getProgress(subsectionId).then(p => {
                                            if (p && p.success && Array.isArray(p.progress.attempts)) {
                                                const attempts = p.progress.attempts.slice();
                                                attempts.sort((a, b) => new Date(b.date || b.completedAt || 0) - new Date(a.date || a.completedAt || 0));
                                                setQuizAttempts(attempts);
                                            }
                                        });
                                    }, 100);
                                    setCompletionData(null);
                                    // FORCE REFRESH attempts immediately
                                    setTimeout(() => {
                                        loadAttempts();
                                        const refreshProgress = async () => {
                                            try {
                                                const p = await getProgress(subsectionId);
                                                if (p && p.success) {
                                                    const attempts = Array.isArray(p.progress.attempts) ? p.progress.attempts.slice() : [];
                                                    attempts.sort((a, b) => new Date(b.date || b.completedAt || 0) - new Date(a.date || a.completedAt || 0));
                                                    const normalized = { ...p.progress, attempts };
                                                    setGameState(prev => ({ ...prev, progress: normalized }));
                                                }
                                            } catch (err) {
                                                console.warn('Failed to refresh progress:', err);
                                            }
                                        };
                                        refreshProgress();
                                    }, 100);
                                }}
                            >
                                Awesome! 🎉
                            </button>
                        </div>
                    </div>
                </div>
            )}
        <div style={{ padding: '12px', background: '#0D1117', minHeight: '100%', color: '#E6EDF3', width: '100%', maxWidth: '100%', boxSizing: 'border-box' }}>
            {/* Quiz Attempts Modal */}
            {showAttemptsModal && (
                <div className="attempts-modal-overlay" onClick={() => setShowAttemptsModal(false)}>
                    <div className="attempts-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="attempts-modal-header">
                            <h2 style={{ margin: 0, color: '#E6EDF3' }}>Quiz Attempts History</h2>
                            <button 
                                className="modal-close-btn"
                                onClick={() => setShowAttemptsModal(false)}
                            >
                                <X size={20} />
                            </button>
                        </div>
                        <div className="attempts-modal-actions">
                            <button 
                                onClick={downloadAttemptsPDF}
                                className="download-btn"
                            >
                                <Download size={16} />
                                Download PDF
                            </button>
                        </div>
                        <div className="attempts-list">
                            {allAttempts.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '40px', color: '#8B949E' }}>
                                    ✨ Your journey starts here. Complete your first quiz to unlock detailed stats.
                                </div>
                            ) : (
                                allAttempts.map((attempt, idx) => (
                                    <div key={idx} className="attempt-item">
                                        <div className="attempt-header">
                                            <div>
                                                <h3 style={{ margin: 0, color: '#E6EDF3', fontSize: '16px' }}>
                                                    Attempt {idx + 1}
                                                </h3>
                                                <p style={{ margin: '4px 0', color: '#8B949E', fontSize: '12px' }}>
                                                    {new Date(attempt.date).toLocaleString()}
                                                </p>
                                            </div>
                                            <div className="attempt-badges">
                                                <span className="difficulty-badge">{attempt.difficulty}</span>
                                                <span className="score-badge">
                                                    {attempt.score}/{attempt.totalQuestions}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="attempt-details">
                                            <div className="detail-item">
                                                <span className="detail-label">Score:</span>
                                                <span className="detail-value">{attempt.score}/{attempt.totalQuestions}</span>
                                            </div>
                                            {attempt.timeMs && (
                                                <div className="detail-item">
                                                    <span className="detail-label">Time:</span>
                                                    <span className="detail-value">{Math.round(attempt.timeMs / 1000)}s</span>
                                                </div>
                                            )}
                                        </div>
                                        {attempt.attemptedQuestions && attempt.attemptedQuestions.length > 0 && (
                                            <div className="attempt-questions">
                                                <details>
                                                    <summary style={{ cursor: 'pointer', color: '#8ab4f8', marginBottom: '8px' }}>
                                                        View Questions ({attempt.attemptedQuestions.length})
                                                    </summary>
                                                    {attempt.attemptedQuestions.map((q, qIdx) => (
                                                        <div key={qIdx} className="question-item">
                                                            <div className="question-text">
                                                                <strong>Q{qIdx + 1}:</strong> {q.question}
                                                            </div>
                                                            <div className="question-answers">
                                                                <div className={`answer-item ${q.selectedAnswer === q.correctAnswer ? 'correct' : 'incorrect'}`}>
                                                                    <span>Your Answer: {q.selectedAnswer || 'N/A'}</span>
                                                                </div>
                                                                <div className="answer-item correct">
                                                                    <span>Correct Answer: {q.correctAnswer || 'N/A'}</span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </details>
                                            </div>
                                        )}
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Quiz or Flashcard Area */}
            <div style={{ position: 'relative' }}>
                {!gameState.currentChallenge ? (
                    <div className="quiz-progress-shell">
                        <div className="quiz-progress-wrapper">
                            <div className="quiz-progress-grid">
                                <div className="quiz-progress-card">
                                    <div className="progress-chip">Your Progress in this section</div>
                                    <h3 className="progress-title">Keep climbing through the mastery tiers</h3>
                                    {gameState.progress ? (
                                        <>
                                            <div className="level-card">
                                                <div className="level-label">Current Level</div>
                                                <div className="level-value">{formatDifficulty(currentDifficulty)}</div>
                                                <p className="level-hint">{levelMessage}</p>
                                            </div>
                                            <div className="level-track">
                                                {difficultyLevels.map((level, idx) => {
                                                    const state =
                                                        idx < currentLevelIndex ? 'completed' :
                                                        idx === currentLevelIndex ? 'active' : '';
                                                    return (
                                                        <div key={level} className={`level-step ${state}`}>
                                                            <span className="level-dot" />
                                                            <span className="level-name">{formatDifficulty(level)}</span>
                                                            {state === 'active' && (
                                                                <span className="level-status">Now</span>
                                                            )}
                                                            {state === 'completed' && (
                                                                <span className="level-status completed">Unlocked</span>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </>
                                    ) : (
                                        <div className="level-card">
                                            <div className="level-label">Current Level</div>
                                            <div className="level-value">Beginner</div>
                                            <p className="level-hint">Start your first quiz to begin tracking progress!</p>
                                        </div>
                                    )}
                                </div>

                                <div className="quiz-attempts-card">
                                    <div className="attempts-header">
                                        <div>
                                            <p className="progress-chip subtle">Previous Attempts</p>
                                            <h4 className="attempts-title">
                                                {totalAttempts > 0 ? `${totalAttempts} recorded runs` : 'No attempts yet'}
                                            </h4>
                                        </div>
                                        {totalAttempts > 0 && (
                                            <button
                                                className="view-history-btn"
                                                onClick={() => setShowAttemptsModal(true)}
                                            >
                                                <Eye size={16} />
                                                View history
                                            </button>
                                        )}
                                    </div>

                                    <div className="attempts-scroll">
                                        {attemptsPreview.length > 0 ? (
                                            attemptsPreview.map((attempt, idx) => {
                                                const perfectScore = attempt.score === attempt.totalQuestions && attempt.totalQuestions > 0;
                                                const attemptNumber = totalAttempts - idx;
                                                return (
                                                    <div key={`${attempt.date || attempt.completedAt || idx}-${idx}`} className="attempt-preview-card">
                                                        <div>
                                                            <div className="attempt-title">
                                                                Attempt {attemptNumber}
                                                                {perfectScore && <span className="perfect-badge">Perfect</span>}
                                                            </div>
                                                            <div className="attempt-meta">
                                                                {formatDifficulty(attempt.difficulty || 'beginner')} •{' '}
                                                                {attempt.date ? new Date(attempt.date).toLocaleString() : 
                                                                 attempt.completedAt ? new Date(attempt.completedAt).toLocaleString() : '—'}
                                                            </div>
                                                            {attempt.timeMs && attempt.timeMs > 0 && (
                                                                <div className="attempt-meta" style={{ fontSize: '11px', marginTop: '4px', opacity: 0.8 }}>
                                                                    ⏱️ {Math.round(attempt.timeMs / 1000)}s
                                                                </div>
                                                            )}
                                                        </div>
                                                        <div className="attempt-score">
                                                            <span>{attempt.score ?? 0}</span>
                                                            <small>/ {attempt.totalQuestions ?? 0}</small>
                                                            {attempt.timeMs && attempt.timeMs > 0 && (
                                                                <p className="attempt-time">{Math.round(attempt.timeMs / 1000)}s</p>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })
                                        ) : (
                                            <div className="attempts-empty">
                                                <p>✨ Your journey starts here.</p>
                                                <span>Complete your first quiz to unlock detailed stats.</span>
                                            </div>
                                        )}
                                    </div>
                                    {totalAttempts > 0 && (
                                        <button
                                            className="view-history-btn ghost"
                                            onClick={() => setShowAttemptsModal(true)}
                                        >
                                            View full attempt history
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Start Quiz Button with Streaming - Questions appear immediately */}
                        <div className="start-quiz-container">
                            {isGenerating ? (
                                <div className="quiz-generating">
                                    <div className="generating-spinner"></div>
                                    <div className="generating-text">
                                        <div className="generating-message">{generationProgress.message}</div>
                                        <div className="generating-progress">
                                            {generationProgress.current > 0 && (
                                                <span>Question {generationProgress.current} of {generationProgress.total}</span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <button 
                                    className="start-quiz-btn"
                                    onClick={startQuizWithStreaming}
                                    disabled={isGenerating}
                                >
                                    <span className="btn-icon">🎯</span>
                                    <span className="btn-text">
                                        <span className="btn-main-text">Start Quiz</span>
                                        <span className="btn-sub-text">Difficulty: {gameState.progress?.difficulty || 'beginner'}</span>
                                    </span>
                                    <span className="btn-arrow">→</span>
                                </button>
                            )}
                        </div>
                    </div>
                ) : gameState.challengeType === 'battle' ? (
                    <QuizCard
                        question={gameState.currentChallenge}
                        currentQuestionIndex={gameState.queueIndex !== undefined ? gameState.queueIndex : (gameState.roundIndex || 0)}
                        totalQuestions={gameState.totalRounds || 5}
                        onAnswer={handleAnswer}
                        onNext={() => {
                            // show the pending flashcard when user clicks Next on MCQ explanation
                            // DON'T increment roundIndex here - a round = MCQ + flashcard
                            console.log('[GameSession] Next button clicked - transitioning to flashcard');
                            setGameState(prev => {
                                // Get the last attempted question for flashcard data
                                const lastAttempt = prev.attemptedQuestions && prev.attemptedQuestions.length > 0 
                                    ? prev.attemptedQuestions[prev.attemptedQuestions.length - 1]
                                    : null;
                                
                                const flash = prev.pendingFlashcard || { 
                                    front: prev.currentChallenge?.question || 'Review', 
                                    back: prev.currentChallenge?.explanation || `Answer: ${prev.currentChallenge?.correctAnswer || ''}`,
                                    // Enhanced flashcard data
                                    question: prev.currentChallenge?.question || lastAttempt?.question,
                                    options: prev.currentChallenge?.options || lastAttempt?.options || [],
                                    correctAnswer: prev.currentChallenge?.correctAnswer || lastAttempt?.correctAnswer,
                                    selectedAnswer: lastAttempt?.selectedAnswer,
                                    explanation: prev.currentChallenge?.explanation || lastAttempt?.explanation,
                                    isCorrect: lastAttempt ? (lastAttempt.selectedAnswer === lastAttempt.correctAnswer) : undefined,
                                    questionId: prev.currentChallenge?.id || lastAttempt?.questionId
                                };
                                const currentRound = prev.roundIndex || 0;
                                const currentQueueIndex = prev.queueIndex || 0;
                                
                                // Check if this is the last round (after flashcard, we'll be done)
                                const isLastRound = (currentRound + 1) >= prev.totalRounds;
                                
                                console.log('[GameSession] Transitioning to flashcard:', {
                                    hasFlashcard: !!flash,
                                    currentRound,
                                    isLastRound,
                                    totalRounds: prev.totalRounds
                                });
                                
                                // Just show flashcard, keep same roundIndex
                                return {
                                    ...prev,
                                    currentChallenge: flash,
                                    challengeType: 'flashcard',
                                    pendingFlashcard: null,
                                    // Keep roundIndex the same - we're still in the same round
                                    questionShownAt: Date.now()
                                };
                            });
                        }}
                    />
                ) : (
                    <Flashcard
                        concept={{
                            ...gameState.currentChallenge,
                            resources: {
                                ...(gameState.currentChallenge?.resources || {}),
                                youtube: [getRandomYouTubeShort(selectedInterest)]
                            }
                        }}
                        onResponse={(res) => {
                            setGameState(prev => {
                                const currentRound = prev.roundIndex || 0;
                                const currentQueueIndex = prev.queueIndex || 0;
                                const nextRound = currentRound + 1; // Increment round after completing MCQ + flashcard
                                const finished = nextRound >= prev.totalRounds;

                                console.log('[Flashcard] Next clicked:', {
                                    currentRound,
                                    nextRound,
                                    totalRounds: prev.totalRounds,
                                    finished,
                                    correctCount: prev.correctCount,
                                    attemptedQuestions: (prev.attemptedQuestions || []).length
                                });

                                if (finished) {
                                    // This is the LAST flashcard - trigger completion popup and save attempt
                                    const finalScore = prev.correctCount || 0;
                                    const finalTotal = prev.totalRounds || 5;
                                    const finalTimeMs = prev.totalMcqTimeMs || 0;
                                    const finalAttemptedQuestions = prev.attemptedQuestions || [];
                                    
                                    console.log('[Flashcard] ✅ Quiz finished! Triggering completion:', {
                                        score: finalScore,
                                        total: finalTotal,
                                        timeMs: finalTimeMs,
                                        attemptedQuestionsCount: finalAttemptedQuestions.length
                                    });
                                    
                                    // Show popup IMMEDIATELY with current data based on points actually earned this quiz
                                    const immediateCompletionInfo = {
                                        points: prev.pointsEarnedThisQuiz || 0,
                                        pointsEarned: prev.pointsEarnedThisQuiz || 0,
                                        score: finalScore,
                                        total: finalTotal,
                                        correctAnswers: finalScore,
                                        wrongAnswers: Math.max(0, finalTotal - finalScore),
                                        difficulty: currentDifficulty,
                                        promoted: false
                                    };
                                    setCompletionData(immediateCompletionInfo);
                                    setShowCompletionPopup(true);
                                    
                                    // ALWAYS submit attempt IMMEDIATELY with ALL quiz data (no skipping)
                                    submitAttempt(finalScore, finalTotal).then(resp => {
                                        console.log('[Flashcard] ✅ Attempt submitted successfully:', resp);
                                        // Update popup with backend response
                                        if (resp && resp.success) {
                                            // Treat any returned `pointsEarned/earned` as a BONUS
                                            // and ADD it on top of the per-question points tracked in state.
                                            const bonusPoints = resp.pointsEarned || resp.earned || 0;
                                            const totalPointsEarned = (prev.pointsEarnedThisQuiz || 0) + bonusPoints;
                                            const updatedCompletionInfo = {
                                                points: totalPointsEarned,
                                                pointsEarned: totalPointsEarned,
                                                score: resp.score !== undefined ? resp.score : finalScore,
                                                total: resp.totalQuestions !== undefined ? resp.totalQuestions : finalTotal,
                                                correctAnswers: resp.correctAnswers !== undefined ? resp.correctAnswers : finalScore,
                                                wrongAnswers: resp.wrongAnswers !== undefined ? resp.wrongAnswers : Math.max(0, finalTotal - finalScore),
                                                difficulty: resp.progress?.difficulty || currentDifficulty,
                                                promoted: resp.promoted || false
                                            };
                                            setCompletionData(updatedCompletionInfo);
                                        }
                                    }).catch(err => {
                                        console.error('[Flashcard] ❌ Failed to submit attempt:', err);
                                        // Keep popup showing with fallback data
                                    });
                                    
                                    // DON'T set showFinal yet - wait until popup is closed
                                    return { 
                                        ...prev, 
                                        roundIndex: nextRound, 
                                        showFinal: false, // Will be set to true when popup closes
                                        currentChallenge: null, 
                                        challengeType: null,
                                        sessionCompleted: true // Flag to track completion
                                    };
                                }

                                // advance queue index and get next mcq for next round
                                const newQueueIndex = currentQueueIndex + 1;
                                const nextMcq = (prev.mcqQueue || [])[newQueueIndex];

                                if (nextMcq) {
                                    // show next mcq - this starts a new round (MCQ + flashcard)
                                    return { 
                                        ...prev, 
                                        roundIndex: nextRound, // Increment round
                                        queueIndex: newQueueIndex, 
                                        currentChallenge: nextMcq, 
                                        challengeType: 'battle', 
                                        questionShownAt: Date.now(),
                                        pendingFlashcard: null // Clear any old flashcard
                                    };
                                }

                                // fallback - no more questions
                                return { 
                                    ...prev, 
                                    roundIndex: nextRound, 
                                    showFinal: true,
                                    currentChallenge: null,
                                    challengeType: null
                                };
                            });
                        }}
                    />
                )}
            </div>
            {/* Final summary - Shows AFTER popup is closed */}
            {gameState.showFinal && completionData && (
                <div style={{ 
                    marginTop: 20, 
                    padding: 24, 
                    background: 'rgba(35, 39, 47, 0.7)', 
                    borderRadius: 16,
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    color: '#E6EDF3',
                    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)'
                }}>
                    <h3 style={{ color: '#E6EDF3', marginTop: 0, marginBottom: 16, fontSize: '20px' }}>Session Complete</h3>
                    <p style={{ color: '#C9D1D9', marginBottom: 8, fontSize: '15px' }}>
                        You answered <strong style={{ color: '#4B8BFF' }}>{completionData.correctAnswers || gameState.correctCount || 0}</strong> out of <strong>{completionData.total || gameState.totalRounds || 5}</strong> correctly.
                    </p>
                    <p style={{ color: '#C9D1D9', marginBottom: 8, fontSize: '15px' }}>
                        Total time spent on MCQs: <strong style={{ color: '#7B5CFF' }}>{Math.round((gameState.totalMcqTimeMs || 0) / 1000)}s</strong>
                    </p>
                    {completionData.pointsEarned > 0 && (
                        <p style={{ color: '#4ade80', marginBottom: 8, fontSize: '15px', fontWeight: 'bold' }}>
                            Points Earned: <strong style={{ color: '#4ade80' }}>+{completionData.pointsEarned}</strong>
                        </p>
                    )}
                    {gameState.progress && (
                        <p style={{ color: '#8B949E', marginBottom: 16, fontSize: '14px' }}>
                            Current Level: <strong style={{ color: '#8ab4f8' }}>{completionData.difficulty || gameState.progress.difficulty || 'beginner'}</strong>
                        </p>
                    )}
                    <div style={{ marginTop: 20 }}>
                        <button
                            onClick={async () => {
                                // Session is already auto-saved via saveQuizAttempt at completion.
                                // This button now simply refreshes attempts/progress and informs the user.
                                console.log('[Save Button] Refreshing attempts/progress (attempt already auto-saved).');
                                try {
                                    await loadAttempts();
                                    const p = await getProgress(subsectionId);
                                    if (p && p.success) {
                                        const attempts = Array.isArray(p.progress.attempts) ? p.progress.attempts.slice() : [];
                                        attempts.sort((a, b) => new Date(b.date || b.completedAt || 0) - new Date(a.date || a.completedAt || 0));
                                        const normalized = { ...p.progress, attempts };
                                        setGameState(prev => ({ ...prev, progress: normalized }));
                                        if (attempts.length > 0) {
                                            setQuizAttempts(attempts);
                                        }
                                    }
                                    alert('Your session was already saved automatically. Stats have been refreshed.');
                                } catch (err) {
                                    console.error('[Save Button] Refresh failed:', err);
                                    alert('Failed to refresh session stats. Please try again.');
                                }
                            }}
                            style={{
                                padding: '12px 24px',
                                background: 'linear-gradient(135deg, #4B8BFF 0%, #7B5CFF 100%)',
                                color: '#fff',
                                border: 'none',
                                borderRadius: '12px',
                                fontSize: '16px',
                                fontWeight: '600',
                                cursor: 'pointer',
                                boxShadow: '0 4px 12px rgba(75, 139, 255, 0.4)',
                                transition: 'all 0.3s ease'
                            }}
                            onMouseEnter={(e) => {
                                e.target.style.transform = 'scale(1.05)';
                                e.target.style.boxShadow = '0 6px 16px rgba(75, 139, 255, 0.6)';
                            }}
                            onMouseLeave={(e) => {
                                e.target.style.transform = 'scale(1)';
                                e.target.style.boxShadow = '0 4px 12px rgba(75, 139, 255, 0.4)';
                            }}
                        >
                            💾 Save Session
                        </button>
                    </div>
                    <div style={{ marginTop: 16 }}>
                        <p style={{ color: '#C9D1D9', marginBottom: 0, fontSize: '14px' }}>
                            Great job completing the quiz! Your session has been recorded.
                        </p>
                    </div>
                </div>
            )}
        </div>
        </div>
    );
}
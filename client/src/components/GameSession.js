import React, { useState, useEffect } from 'react';
import QuizCard from './QuizCard';
import Flashcard from './Flashcard';
import { fetchNext, postAnswer, attemptComplete, getProgress, generateQuiz, getAttempts } from '../services/quizService';
import { jsPDF } from 'jspdf';
import { Download, Eye, X } from 'lucide-react';
import './GameSession.css';
// We'll emit a global event so the dashboard can refresh points when the server awards them

export default function GameSession({ subsectionId }) {
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
        rewardVideo: null
    });
    const [selectedInterest, setSelectedInterest] = useState('ai');
    const [isGenerating, setIsGenerating] = useState(false);
    const [generationProgress, setGenerationProgress] = useState({ current: 0, total: 5, message: '' });
    const [showCompletionPopup, setShowCompletionPopup] = useState(false);
    const [completionData, setCompletionData] = useState(null);
    const [showAttemptsModal, setShowAttemptsModal] = useState(false);
    const [quizAttempts, setQuizAttempts] = useState([]);
    const difficultyLevels = ['beginner', 'intermediate', 'advanced'];
    const progressData = gameState.progress || {};
    const currentDifficulty = progressData.difficulty || 'beginner';
    const currentLevelIndex = Math.max(0, difficultyLevels.indexOf(currentDifficulty));
    const nextDifficulty = currentLevelIndex >= difficultyLevels.length - 1 ? null : difficultyLevels[currentLevelIndex + 1];
    const attemptsList = Array.isArray(progressData.attempts) ? progressData.attempts : [];
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
                rewardVideo: null,
                attemptSubmitted: false,
                usedQuestionIds: [] // Track used questions to prevent repetition
            }));
        };

        const loadProgress = async () => {
            if (!subsectionId) return;
            try {
                const res = await getProgress(subsectionId);
                if (res && res.success) {
                    // normalize attempts: ensure array and sort by date desc so newest appears first
                    const attempts = Array.isArray(res.progress.attempts) ? res.progress.attempts.slice() : [];
                    attempts.sort((a, b) => new Date(b.date) - new Date(a.date));
                    const normalized = { ...res.progress, attempts };
                    setGameState(prev => ({ ...prev, difficulty: normalized.difficulty || prev.difficulty, progress: normalized }));
                }
            } catch (err) {
                console.warn('Failed to load progress', err);
            }
        };

        resetGameState();
        loadProgress();
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
                    alert('Failed to generate quiz: ' + (event.message || 'Unknown error'));
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
                alert('Failed to generate quiz: ' + (result?.error || 'Unknown error'));
            }
        } catch (error) {
            console.error('Error starting quiz:', error);
            setIsGenerating(false);
            alert('Failed to start quiz: ' + (error.message || 'Unknown error'));
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
        if (!gameState.challengeType === 'battle') return;

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
            
            // If points were earned, trigger points update event
            if (answerResponse?.pointsEarned && answerResponse.pointsEarned > 0) {
                console.log(`[Points] ✅ Earned ${answerResponse.pointsEarned} points for correct answer. New total: ${answerResponse.newPointsTotal}`);
                // Dispatch event to update points display immediately
                try {
                    const event = new CustomEvent('pointsUpdated', { 
                        detail: { 
                            earned: answerResponse.pointsEarned, 
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
                        ev.detail = { earned: answerResponse.pointsEarned, newTotal: answerResponse.newPointsTotal };
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
                              `Answer: ${prev.currentChallenge?.correctAnswer || ''}`
                    }
                };
            });
        } catch (error) {
            console.error('Failed to submit answer:', error);
        }
    };

    const submitAttemptIfNeeded = async (score, total) => {
        try {
            if (!subsectionId) {
                console.warn('submitAttemptIfNeeded: No subsectionId provided');
                return;
            }
            // avoid duplicate submission by setting attemptSubmitted atomically
            let shouldSubmit = false;
            let finalScore = score;
            let finalTotal = total;
            let finalTimeMs = 0;
            let finalAttemptedQuestions = [];
            
            setGameState(prev => {
                if (prev.attemptSubmitted) {
                    console.log('submitAttemptIfNeeded: Already submitted, skipping');
                    return prev;
                }
                shouldSubmit = true;
                // Use current state values to ensure we have the latest
                finalScore = prev.correctCount || score || 0;
                finalTotal = prev.totalRounds || total || 0;
                finalTimeMs = prev.totalMcqTimeMs || 0;
                finalAttemptedQuestions = prev.attemptedQuestions || [];
                
                console.log('[Submit Attempt] Using state values:', {
                    correctCount: prev.correctCount,
                    totalRounds: prev.totalRounds,
                    totalMcqTimeMs: prev.totalMcqTimeMs,
                    attemptedQuestionsCount: (prev.attemptedQuestions || []).length
                });
                
                return { ...prev, attemptSubmitted: true };
            });
            
            if (shouldSubmit) {
                console.log('submitAttemptIfNeeded: Submitting attempt', { 
                    subsectionId, 
                    score: finalScore, 
                    total: finalTotal, 
                    timeMs: finalTimeMs,
                    attemptedQuestionsCount: finalAttemptedQuestions.length
                });
                const resp = await attemptComplete({ 
                    subsectionId, 
                    score: finalScore, 
                    totalQuestions: finalTotal, 
                    timeMs: finalTimeMs, 
                    attemptedQuestions: finalAttemptedQuestions 
                });
                console.log('attemptComplete response:', resp);

                // If backend returned earned points or unlocked games, show a brief UI notification
                try {
                    if (resp && resp.success) {
                        const earned = resp.earned || 0;
                        console.log('Points earned:', earned, 'Full response:', resp);
                        
                        // Show animated completion popup
                        setCompletionData({
                            points: resp.earned || 0,
                            score: resp.score || finalScore,
                            total: resp.totalQuestions || finalTotal,
                            difficulty: resp.progress?.difficulty || 'beginner',
                            promoted: resp.promoted || false
                        });
                        setShowCompletionPopup(true);
                        
                        if (typeof earned === 'number' && earned > 0) {
                            // Dispatch a global event so top-level Dashboard can refresh canonical points
                            try {
                                window.dispatchEvent(new CustomEvent('pointsUpdated', { detail: { earned: earned, unlocked: resp.unlocked || [] } }));
                            } catch (e) {
                                // some older browsers may not support CustomEvent constructor
                                const ev = document.createEvent('Event');
                                ev.initEvent('pointsUpdated', true, true);
                                ev.detail = { earned: earned, unlocked: resp.unlocked || [] };
                                window.dispatchEvent(ev);
                            }
                        } else {
                            console.warn('No points earned or points is 0. Response:', resp);
                        }
                    } else {
                        console.error('attemptComplete failed or returned error:', resp);
                    }

                    if (resp && Array.isArray(resp.unlocked) && resp.unlocked.length > 0) {
                        setGameState(prev => ({ ...prev, lastUnlocked: resp.unlocked }));
                        setTimeout(() => {
                            setGameState(prev => {
                                const copy = { ...prev };
                                delete copy.lastUnlocked;
                                return copy;
                            });
                        }, 7000);
                    }
                } catch (uiErr) {
                    console.warn('Failed to show earned points notification', uiErr);
                }
                // Always refresh canonical progress from server to avoid shape/mapping issues
                try {
                    const p = await getProgress(subsectionId);
                    if (p && p.success) {
                        const attempts = Array.isArray(p.progress.attempts) ? p.progress.attempts.slice() : [];
                        attempts.sort((a, b) => new Date(b.date) - new Date(a.date));
                        const normalized = { ...p.progress, attempts };
                        setGameState(prev => ({ ...prev, progress: normalized }));
                    } else if (resp && resp.success && resp.progress) {
                        // fallback: use resp.progress but still normalize
                        const attempts = Array.isArray(resp.progress.attempts) ? resp.progress.attempts.slice() : [];
                        attempts.sort((a, b) => new Date(b.date) - new Date(a.date));
                        setGameState(prev => ({ ...prev, progress: { ...resp.progress, attempts } }));
                    }
                } catch (err) {
                    console.warn('Failed to refresh progress after attemptComplete', err);
                }
            }
        } catch (e) {
            console.warn('attemptComplete failed', e);
        }
    };



    // Load quiz attempts
    const loadAttempts = async () => {
        if (!subsectionId) return;
        try {
            const result = await getAttempts(subsectionId);
            if (result.success && result.attempts) {
                setQuizAttempts(result.attempts);
            }
        } catch (error) {
            console.error('Failed to load attempts:', error);
        }
    };

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
        <div style={{ padding: '20px', background: '#0D1117', minHeight: '100vh', color: '#E6EDF3' }}>
            {/* Animated Completion Popup */}
            {showCompletionPopup && completionData && (
                <div className="completion-popup-overlay" onClick={() => setShowCompletionPopup(false)}>
                    <div className="completion-popup" onClick={(e) => e.stopPropagation()}>
                        <div className="completion-popup-content">
                            <div className="completion-icon">🎉</div>
                            <h2 className="completion-title">Congratulations!</h2>
                            <div className="completion-points">
                                <span className="points-number">+{completionData.points}</span>
                                <span className="points-label">Points Added</span>
                            </div>
                            <div className="completion-stats">
                                <div className="stat-item">
                                    <span className="stat-label">Score</span>
                                    <span className="stat-value">{completionData.score}/{completionData.total}</span>
                                </div>
                                <div className="stat-item">
                                    <span className="stat-label">Level</span>
                                    <span className="stat-value">{completionData.difficulty}</span>
                                </div>
                            </div>
                            {completionData.promoted && (
                                <div className="promotion-badge">
                                    ⬆️ Level Up! You've been promoted to {completionData.difficulty}!
                                </div>
                            )}
                            <button 
                                className="completion-close-btn"
                                onClick={() => setShowCompletionPopup(false)}
                            >
                                Continue
                            </button>
                        </div>
                    </div>
                </div>
            )}
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
                            {quizAttempts.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '40px', color: '#8B949E' }}>
                                    No quiz attempts yet. Complete a quiz to see your history here.
                                </div>
                            ) : (
                                quizAttempts.map((attempt, idx) => (
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

                        {gameState.progress && (
                            <div className="quiz-progress-wrapper">
                                <div className="quiz-progress-grid">
                                    <div className="quiz-progress-card">
                                        <div className="progress-chip">Your Progress in this section</div>
                                        <h3 className="progress-title">Keep climbing through the mastery tiers</h3>
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
                                                        <div key={`${attempt.date}-${idx}`} className="attempt-preview-card">
                                                            <div>
                                                                <div className="attempt-title">
                                                                    Attempt {attemptNumber}
                                                                    {perfectScore && <span className="perfect-badge">Perfect</span>}
                                                                </div>
                                                                <div className="attempt-meta">
                                                                    {formatDifficulty(attempt.difficulty || 'beginner')} •{' '}
                                                                    {attempt.date ? new Date(attempt.date).toLocaleString() : '—'}
                                                                </div>
                                                            </div>
                                                            <div className="attempt-score">
                                                                <span>{attempt.score ?? 0}</span>
                                                                <small>/ {attempt.totalQuestions ?? 0}</small>
                                                                {attempt.timeMs && (
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
                        )}

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
                        onAnswer={handleAnswer}
                        onNext={() => {
                            // show the pending flashcard when user clicks Next on MCQ explanation
                            // DON'T increment roundIndex here - a round = MCQ + flashcard
                            setGameState(prev => {
                                const flash = prev.pendingFlashcard || { front: 'Review', back: '' };
                                const currentRound = prev.roundIndex || 0;
                                const currentQueueIndex = prev.queueIndex || 0;
                                
                                // Check if this is the last round (after flashcard, we'll be done)
                                const isLastRound = (currentRound + 1) >= prev.totalRounds;
                                
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
                        concept={gameState.currentChallenge}
                        onResponse={(res) => {
                            setGameState(prev => {
                                const currentRound = prev.roundIndex || 0;
                                const currentQueueIndex = prev.queueIndex || 0;
                                const nextRound = currentRound + 1; // Increment round after completing MCQ + flashcard
                                const finished = nextRound >= prev.totalRounds;

                                if (finished) {
                                    // submit attempt after marking final
                                    submitAttemptIfNeeded(prev.correctCount || 0, prev.totalRounds);
                                    return { 
                                        ...prev, 
                                        roundIndex: nextRound, 
                                        showFinal: true, 
                                        currentChallenge: null, 
                                        challengeType: null 
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
            {/* Final summary */}
            {gameState.showFinal && (
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
                        You answered <strong style={{ color: '#4B8BFF' }}>{gameState.correctCount || 0}</strong> out of <strong>{gameState.totalRounds}</strong> correctly.
                    </p>
                    <p style={{ color: '#C9D1D9', marginBottom: 16, fontSize: '15px' }}>
                        Total time spent on MCQs: <strong style={{ color: '#7B5CFF' }}>{Math.round((gameState.totalMcqTimeMs || 0) / 1000)}s</strong>
                    </p>
                    {gameState.progress && (
                        <p style={{ color: '#8B949E', marginBottom: 16, fontSize: '14px' }}>
                            Current Level: <strong style={{ color: '#8ab4f8' }}>{gameState.progress.difficulty || 'beginner'}</strong>
                        </p>
                    )}
                    { (gameState.correctCount || 0) >= 3 ? (
                        <div>
                            <p style={{ color: '#C9D1D9', marginBottom: 12 }}>
                                Congratulations! You qualify for a reward based on your interest ({selectedInterest}).
                            </p>
                            <button 
                                className="primary-btn" 
                                onClick={() => setGameState(prev => ({ ...prev, rewardVideo: getRandomYouTubeShort(selectedInterest) }))}
                                style={{ 
                                    marginBottom: 12,
                                    background: 'linear-gradient(135deg, #4B8BFF 0%, #7B5CFF 100%)',
                                    border: 'none',
                                    padding: '12px 24px',
                                    borderRadius: '8px',
                                    color: '#fff',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    transition: 'all 0.2s'
                                }}
                            >
                                See your reward
                            </button>
                            {gameState.rewardVideo && (
                                <div style={{ marginTop: 12 }}>
                                    <iframe 
                                        width="560" 
                                        height="315" 
                                        src={gameState.rewardVideo} 
                                        title="Educational Reward" 
                                        frameBorder="0" 
                                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                                        allowFullScreen
                                        style={{ borderRadius: '8px' }}
                                        onError={(e) => {
                                            console.warn('Video failed to load:', e);
                                            setGameState(prev => ({
                                                ...prev,
                                                rewardVideo: getRandomYouTubeShort(selectedInterest)
                                            }));
                                        }}
                                    ></iframe>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div>
                            <p style={{ color: '#8B949E' }}>
                                Try better luck next time — answer at least 3 correctly to unlock a reward.
                            </p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import QuizCard from "./QuizCard";
import Flashcard from "./Flashcard";
import ProgressBar from "./ProgressBar";
import DifficultyIndicator from "./DifficultyIndicator";
import {
  fetchNext,
  postAnswer,
  createSession,
  getSession,
  getProgress,
  attemptComplete,
  generateQuiz,
} from "../services/quizService";
import "./QuizSession.css";

export default function QuizSession() {
  const { subsectionId } = useParams();

  const [sessionState, setSessionState] = useState({
    currentActivity: null, // 'mcq' | 'flashcard'
    mcq: null,
    flashcard: null,
    difficulty: "beginner",
    mastery: 0,
    xp: 0,
    streak: 0,
    sessionStart: Date.now(),
    questions: [],
    currentQuestionStart: null,
    totalCorrect: 0,
    attempted: 0,
    sessionId: null,
    lastAnswerCorrect: false,
  });

  const [history, setHistory] = useState({ attempts: [], difficulty: 'beginner' });
  const [earnedToast, setEarnedToast] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState({ current: 0, total: 5, message: '' });
  const [needsGeneration, setNeedsGeneration] = useState(false);

  // 🧠 Load or create session on mount - RESET when subsection changes
  useEffect(() => {
    // Reset all state when subsection changes
    setSessionState({
      currentActivity: null,
      mcq: null,
      flashcard: null,
      difficulty: "beginner",
      mastery: 0,
      xp: 0,
      streak: 0,
      sessionStart: Date.now(),
      questions: [],
      currentQuestionStart: null,
      totalCorrect: 0,
      attempted: 0,
      sessionId: null,
      lastAnswerCorrect: false,
    });
    setHistory({ attempts: [], difficulty: 'beginner' });
    setEarnedToast(null);
    setIsGenerating(false);
    setGenerationProgress({ current: 0, total: 5, message: '' });
    setNeedsGeneration(false);
    
    // Clear localStorage for old subsection
    const oldKeys = Object.keys(localStorage).filter(key => key.startsWith('quiz_session_'));
    oldKeys.forEach(key => localStorage.removeItem(key));

    const initSession = async () => {
      try {
        const saved = localStorage.getItem(`quiz_session_${subsectionId}`);

        if (saved) {
          // Try to load existing session from backend
          const parsed = JSON.parse(saved);
          const response = await getSession(parsed.sessionId);

          if (response?.success && response.data) {
            setSessionState((prev) => ({
              ...prev,
              ...response.data,
              sessionId: parsed.sessionId,
            }));
            return;
          }
        }

        // Create new session if none or load failed
        const newSession = await createSession(subsectionId);
        if (newSession?.success) {
          localStorage.setItem(
            `quiz_session_${subsectionId}`,
            JSON.stringify({ sessionId: newSession.sessionId })
          );
          setSessionState((prev) => ({
            ...prev,
            sessionId: newSession.sessionId,
          }));
        }
      } catch (err) {
        console.error("Session initialization failed:", err);
      }
    };

    if (subsectionId) {
      initSession();
    }
  }, [subsectionId]);

  // Load history/progress for this subsection
  useEffect(() => {
    let mounted = true;
    async function loadProgress() {
      if (!subsectionId) return;
      try {
        const res = await getProgress(subsectionId);
        if (!mounted) return;
        if (res?.success) {
          setHistory({ attempts: res.progress.attempts || [], difficulty: res.progress.difficulty || 'beginner' });
        }
      } catch (err) {
        console.error('Failed to load progress history', err);
      }
    }
    loadProgress();
    return () => (mounted = false);
  }, [subsectionId]);

  // 💾 Save session to localStorage whenever updated
  useEffect(() => {
    if (sessionState.sessionId) {
      localStorage.setItem(
        `quiz_session_${subsectionId}`,
        JSON.stringify(sessionState)
      );
    }
  }, [sessionState, subsectionId]);

  // 📥 Load next question
  const loadNext = async () => {
    try {
      const response = await fetchNext({
        subsectionId,
        previous_difficulty: sessionState.difficulty,
        last_answer_correct: sessionState.lastAnswerCorrect,
        sessionId: sessionState.sessionId,
      });

      if (response?.success) {
        setSessionState((prev) => ({
          ...prev,
          currentActivity: "mcq",
          mcq: response.mcq,
          flashcard: response.flashcard,
          difficulty: response.difficulty || prev.difficulty,
          currentQuestionStart: Date.now(),
        }));
      } else if (response?.needsGeneration) {
        setNeedsGeneration(true);
      }
    } catch (error) {
      console.error("Failed to load next question:", error);
      if (error.message?.includes('not found') || error.message?.includes('generate')) {
        setNeedsGeneration(true);
      }
    }
  };

  // 🚀 Start quiz with streaming - questions appear as they're generated
  const startQuizWithStreaming = async () => {
    if (!subsectionId) return;
    
    setIsGenerating(true);
    setNeedsGeneration(false);
    setGenerationProgress({ current: 0, total: 5, message: 'Starting quiz generation...' });
    
    const difficulty = history.difficulty || 'beginner';
    const questions = [];
    
    try {
      // Use streaming endpoint - questions will arrive one at a time
      const result = await generateQuiz(subsectionId, difficulty, (event) => {
        if (event.type === 'question' && event.question) {
          // Question is ready - add it to questions array
          questions.push(event.question);
          
          setGenerationProgress({
            current: event.index + 1,
            total: event.total,
            message: `Question ${event.index + 1} ready!`
          });
          
          // Show first question immediately
          if (questions.length === 1) {
            setSessionState(prev => ({
              ...prev,
              currentActivity: "mcq",
              mcq: event.question,
              difficulty: difficulty,
              currentQuestionStart: Date.now(),
            }));
            setIsGenerating(false); // Hide loading once first question shows
          }
        } else if (event.type === 'progress') {
          setGenerationProgress({
            current: event.current || 0,
            total: event.total || 5,
            message: event.message || 'Generating questions...'
          });
        } else if (event.type === 'complete') {
          setIsGenerating(false);
          setGenerationProgress({ current: 5, total: 5, message: 'All questions ready!' });
          
          // If we have questions but haven't shown first one yet
          if (questions.length > 0 && !sessionState.currentActivity) {
            setSessionState(prev => ({
              ...prev,
              currentActivity: "mcq",
              mcq: questions[0],
              difficulty: difficulty,
              currentQuestionStart: Date.now(),
            }));
          }
        } else if (event.type === 'error') {
          setIsGenerating(false);
          alert('Failed to generate quiz: ' + (event.message || 'Unknown error'));
        }
      });
      
      // If streaming completed but we didn't get questions through events
      if (result && result.success && result.quiz && result.quiz.questions) {
        if (questions.length === 0 && result.quiz.questions.length > 0) {
          setSessionState(prev => ({
            ...prev,
            currentActivity: "mcq",
            mcq: result.quiz.questions[0],
            difficulty: difficulty,
            currentQuestionStart: Date.now(),
          }));
        }
        setIsGenerating(false);
      }
    } catch (error) {
      console.error('Error starting quiz:', error);
      setIsGenerating(false);
      alert('Failed to start quiz: ' + (error.message || 'Unknown error'));
    }
  };

  // 🧩 Handle MCQ answer
  const handleMCQAnswer = async (correct) => {
    const timeSpent = Date.now() - (sessionState.currentQuestionStart || 0);

    try {
      const response = await postAnswer({
        subsectionId,
        correct,
        questionId: sessionState.mcq?.id,
        timeSpent,
        sessionId: sessionState.sessionId,
      });

      if (response?.success) {
        setSessionState((prev) => ({
          ...prev,
          mastery: response.mastery || prev.mastery,
          xp: response.xp || prev.xp,
          streak: correct ? prev.streak + 1 : 0,
          lastAnswerCorrect: correct,
          totalCorrect: prev.totalCorrect + (correct ? 1 : 0),
          attempted: prev.attempted + 1,
          questions: [
            ...prev.questions,
            {
              id: sessionState.mcq?.id,
              type: "mcq",
              correct,
              timeSpent,
            },
          ],
          currentActivity: "flashcard", // move to flashcard
        }));
      }
    } catch (error) {
      console.error("Failed to submit MCQ answer:", error);
    }
  };

  // 🧠 Handle Flashcard response
  const handleFlashcardResponse = async (gotIt) => {
    const timeSpent = Date.now() - (sessionState.currentQuestionStart || 0);

    try {
      const response = await postAnswer({
        subsectionId,
        correct: gotIt,
        flashcardId: sessionState.flashcard?.id,
        timeSpent,
        sessionId: sessionState.sessionId,
      });

      if (response?.success) {
        setSessionState((prev) => ({
          ...prev,
          mastery: response.mastery || prev.mastery,
          xp: response.xp || prev.xp,
          totalCorrect: prev.totalCorrect + (gotIt ? 1 : 0),
          attempted: prev.attempted + 1,
          questions: [
            ...prev.questions,
            {
              id: sessionState.flashcard?.id,
              type: "flashcard",
              correct: gotIt,
              timeSpent,
            },
          ],
          currentActivity: null, // ready for next
        }));

        // Load next question after short delay
        setTimeout(loadNext, 300);
      }
    } catch (error) {
      console.error("Failed to submit flashcard response:", error);
    }
  };

    // Finish session and submit aggregate attempt to backend (awards points)
    const finishSession = async () => {
      try {
        const score = sessionState.totalCorrect || 0;
        const total = sessionState.attempted || sessionState.questions.length || 0;
        const timeMs = Date.now() - (sessionState.sessionStart || Date.now());
        const res = await attemptComplete({ subsectionId, score, totalQuestions: total, timeMs, attemptedQuestions: sessionState.questions || [] });
        if (res && res.success) {
          if (typeof res.earned === 'number' && res.earned > 0) {
            setEarnedToast(res.earned);
            // dispatch global event so dashboard refreshes points
            try {
              window.dispatchEvent(new CustomEvent('pointsUpdated', { detail: { earned: res.earned, unlocked: res.unlocked || [] } }));
            } catch (e) {
              const ev = document.createEvent('Event');
              ev.initEvent('pointsUpdated', true, true);
              ev.detail = { earned: res.earned, unlocked: res.unlocked || [] };
              window.dispatchEvent(ev);
            }
            setTimeout(() => setEarnedToast(null), 4500);
          }

          // Refresh local history/progress
          try {
            const p = await getProgress(subsectionId);
            if (p && p.success) {
              setHistory({ attempts: p.progress.attempts || [], difficulty: p.progress.difficulty || 'beginner' });
            }
          } catch (err) {
            console.warn('Failed to refresh progress after finishSession', err);
          }
        }
      } catch (err) {
        console.error('finishSession failed', err);
      }
    };

  // ⚡ Auto-load first question (only if quiz exists)
  useEffect(() => {
    if (!sessionState.currentActivity && sessionState.sessionId && !needsGeneration) {
      loadNext();
    }
  }, [sessionState.sessionId, needsGeneration]);

  return (
    <div className="quiz-session">
      {/* Earned points notification */}
      {earnedToast && (
        <div style={{ position: 'fixed', top: 80, right: 24, zIndex: 4000 }}>
          <div style={{ background: '#0f172a', color: '#fff', padding: '10px 14px', borderRadius: 10, boxShadow: '0 6px 20px rgba(0,0,0,0.4)' }}>
            <strong style={{ marginRight: 8 }}>+{earnedToast} points</strong>
            <span style={{ opacity: 0.9 }}>earned for this attempt</span>
          </div>
        </div>
      )}
      {/* Header & Stats */}
      <div className="quiz-session-header">
        <div className="stats">
          <div>✨ XP: {sessionState.xp}</div>
          <div>🔥 Streak: {sessionState.streak}</div>
          <div>✅ Correct: {sessionState.totalCorrect}</div>
          <div>🎯 Attempted: {sessionState.attempted}</div>
        </div>
        <div className="history-summary">
          <div>📚 Previous Attempts: {history.attempts.length}</div>
          <div>🔰 Difficulty: {history.difficulty}</div>
        </div>
      </div>

      {/* Progress */}
      <div className="quiz-progress">
        <ProgressBar value={sessionState.mastery} />
        <DifficultyIndicator difficulty={sessionState.difficulty} />
      </div>
      {/* Attempt history list */}
      <div className="quiz-history" style={{ maxWidth: 800, margin: '16px auto' }}>
        <h4>Attempt History</h4>
        {history.attempts.length === 0 && <div>No attempts yet.</div>}
        {history.attempts.length > 0 && (
          <ul>
            {history.attempts.map((a, idx) => (
              <li key={idx}>
                <strong>{new Date(a.date || a.completedAt).toLocaleString()}</strong> — Score: {a.score}/{a.totalQuestions} — Time: {a.timeMs ? Math.round(a.timeMs/1000)+'s' : 'N/A'} — Difficulty: {a.difficulty}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Content */}
      <div className="card-container">
        {sessionState.currentActivity === "mcq" && (
          <QuizCard question={sessionState.mcq} onAnswer={handleMCQAnswer} />
        )}

        {sessionState.currentActivity === "flashcard" && (
          <Flashcard
            concept={sessionState.flashcard}
            onResponse={handleFlashcardResponse}
          />
        )}

        {!sessionState.currentActivity && (
          <div className="no-activity">
            {needsGeneration || (!isGenerating && !sessionState.sessionId) ? (
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
                      <span className="btn-sub-text">Difficulty: {history.difficulty || 'beginner'}</span>
                    </span>
                    <span className="btn-arrow">→</span>
                  </button>
                )}
              </div>
            ) : (
              <>
                <div>Loading your next question...</div>
                <div style={{ marginTop: 12 }}>
                  <button className="primary-btn" onClick={finishSession}>
                    Finish Session & Claim Points
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

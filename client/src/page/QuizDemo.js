import React, { useState, useEffect } from 'react';
import QuizCard from '../components/QuizCard';
import Flashcard from '../components/Flashcard';
import ProgressBar from '../components/ProgressBar';
import DifficultyIndicator from '../components/DifficultyIndicator';
import RewardModal from '../components/RewardModal';
import useSession from '../hooks/useSession';
import { fetchNext, postAnswer } from '../services/quizService';

export default function QuizDemo() {
    const [mcq, setMcq] = useState(null);
    const [currentFlashcard, setCurrentFlashcard] = useState(null);
    const [difficulty, setDifficulty] = useState('intermediate');
    const [progress, setProgress] = useState(0);

    // session hook
    const session = useSession({ xp: 0, streak: 0 });
    const { xp, addXp, streak, recordAnswer, flashcardQueue, setFlashcardQueue } = session;

    const [rewardOpen, setRewardOpen] = useState(false);
    const [rewardVideo, setRewardVideo] = useState(null);

    const adjustDifficultyUp = () => {
        setDifficulty((d) => (d === 'easy' ? 'intermediate' : d === 'intermediate' ? 'hard' : 'hard'));
    };

    const adjustDifficultyDown = () => {
        setDifficulty((d) => (d === 'hard' ? 'intermediate' : d === 'intermediate' ? 'easy' : 'easy'));
    };

    const loadNext = async () => {
        // If there's a queued flashcard, show it first (spaced repetition)
        if (flashcardQueue.length > 0) {
            const [next, ...rest] = flashcardQueue;
            setFlashcardQueue(rest);
            setCurrentFlashcard(next);
            setMcq(null);
            return;
        }

        // Get current subsectionId from URL or state
        const urlParams = new URLSearchParams(window.location.search);
        const subsectionId = urlParams.get('subsectionId') || localStorage.getItem('currentSubsectionId');
        
        const resp = await fetchNext({ 
            topic: 'Artificial Intelligence', 
            previous_difficulty: difficulty,
            subsectionId: subsectionId
        });
        if (resp.success) {
            // Store the subsectionId for future requests
            if (resp.mcq && resp.mcq.subsectionId) {
                localStorage.setItem('currentSubsectionId', resp.mcq.subsectionId);
            }
            setMcq(resp.mcq || null);
            // server may optionally return a flashcard; keep it queued to show after the MCQ
            if (resp.flashcard) setFlashcardQueue((q) => [...q, resp.flashcard]);
            // persist difficulty from server if provided
            if (resp.difficulty) setDifficulty(resp.difficulty);
        } else {
            alert('Failed: ' + (resp.error || 'unknown'));
        }
    };

    const handleAnswer = async (correct) => {
        if (!mcq) return;

        // Update local adaptive counters
        // update session counters + xp
        recordAnswer(correct);
        if (correct) addXp(10);

        // Notify backend
        try {
            const resp = await postAnswer({ subsectionId: mcq.subsectionId, correct });
            if (resp.success) setProgress(resp.mastery || 0);
        } catch (e) {
            console.error('Answer post failed', e);
        }

        // Difficulty adjustments based on consecutive answers
        // simple adaptive difficulty check using server-provided progress values
        // leave final adjustments to server, but we can nudge locally if needed

        // After answering an MCQ, show the next flashcard in queue (if available)
        if (flashcardQueue.length > 0) {
            const [next, ...rest] = flashcardQueue;
            setFlashcardQueue(rest);
            setCurrentFlashcard(next);
            setMcq(null);
        } else {
            loadNext();
        }
    };

    const handleFlashcardResponse = async (gotIt) => {
        if (!currentFlashcard) return;

        // simple XP/streak update
        if (gotIt) {
            addXp(5);
            // recordAnswer will be called on backend update as well - locally just nudge streak
        } else {
            // small xp penalty
            addXp(-2);
        }

        // Inform backend about flashcard performance (best-effort)
        try {
            await postAnswer({ subsectionId: currentFlashcard.subsectionId, correct: gotIt });
        } catch (e) {
            console.error('Flashcard post failed', e);
        }

        // If user needs revision, requeue the flashcard to show again later in the session
        if (!gotIt) {
            setFlashcardQueue((q) => [...q, currentFlashcard]);
        }

        // clear current flashcard and load next (either queued flashcard or MCQ)
        setCurrentFlashcard(null);
        // small delay for UX
        setTimeout(() => loadNext(), 300);
    };

    // reward modal trigger when crossing XP threshold (example: 200 xp)
    useEffect(() => {
        if (xp >= 200) {
            setRewardVideo('https://www.youtube.com/embed/dQw4w9WgXcQ'); // placeholder, replace with YouTube API call
            setRewardOpen(true);
        }
    }, [xp]);

    return (
        <div>
            <h2>Quiz Demo</h2>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <DifficultyIndicator difficulty={difficulty} />
                <ProgressBar value={progress} />
                <div style={{ fontWeight: 600 }}>XP: {xp}</div>
                <div style={{ fontWeight: 600 }}>Streak: {streak}</div>
            </div>

            <div style={{ marginTop: 12 }}>
                <button onClick={loadNext}>Start / Next</button>
            </div>

            <div style={{ marginTop: 18 }}>
                {mcq && <QuizCard question={mcq} onAnswer={handleAnswer} onTimeout={async () => {
                    // treat timeout as incorrect and notify backend
                    try {
                        await postAnswer({ subsectionId: mcq.subsectionId, correct: false, status: 'timeout' });
                    } catch (e) {
                        console.error('Timeout post failed', e);
                    }
                    handleAnswer(false);
                }} timeLimit={difficulty === 'easy' ? 25 : difficulty === 'hard' ? 15 : 20} />}
                {currentFlashcard && <Flashcard concept={currentFlashcard} onResponse={handleFlashcardResponse} />}
                <RewardModal open={rewardOpen} onClose={() => setRewardOpen(false)} videoUrl={rewardVideo} message={`Nice! You reached ${xp} XP`} />
            </div>
        </div>
    );
}

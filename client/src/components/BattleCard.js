import React, { useState } from 'react';
import './GameSession.css';
import './BattleCard.css';

export default function BattleCard({ question, onAnswer }) {
    const [selectedAnswer, setSelectedAnswer] = useState(null);
    const [showResult, setShowResult] = useState(false);
    const [showEffect, setShowEffect] = useState(false);

    if (!question) return null;

    const handleAnswer = (option) => {
        setSelectedAnswer(option);
        setShowEffect(true);
        
        // Show the result feedback
        setShowResult(true);

        // Trigger attack animation
        setTimeout(() => {
            setShowEffect(false);
            const correct = option === question.correctAnswer;
            onAnswer(correct);
        }, 1000);
    };

    return (
        <div className="battle-card">
            {/* Difficulty Badge */}
            <div className="challenge-badge">
                <div className={`difficulty ${question.difficulty.toLowerCase()}`}>
                    {question.difficulty} Challenge
                </div>
            </div>

            {/* Question Display */}
            <div className="question-display">
                <h2>{question.question}</h2>
                
                {showEffect && (
                    <div className="battle-effects">
                        {selectedAnswer === question.correctAnswer ? (
                            <div className="hit-effect correct">✨</div>
                        ) : (
                            <div className="hit-effect incorrect">💥</div>
                        )}
                    </div>
                )}
            </div>

            {/* Answer Options */}
            <div className="battle-options">
                {question.options.map((option, index) => (
                    <button
                        key={index}
                        className={`battle-option ${
                            showResult
                                ? option === question.correctAnswer
                                    ? 'correct'
                                    : option === selectedAnswer
                                    ? 'incorrect'
                                    : ''
                                : ''
                        } ${showEffect && option === selectedAnswer ? 'attacking' : ''}`}
                        onClick={() => !showResult && handleAnswer(option)}
                        disabled={showResult}
                    >
                        <div className="option-content">
                            <span className="option-text">{option}</span>
                            {showResult && option === question.correctAnswer && (
                                <span className="option-icon">✨</span>
                            )}
                        </div>
                    </button>
                ))}
            </div>

            {/* Explanation (shows after answer) */}
            {showResult && (
                <div className={`explanation ${
                    selectedAnswer === question.correctAnswer ? 'correct' : 'incorrect'
                }`}>
                    <p>{question.explanation}</p>
                </div>
            )}

            {/* Battle Effects */}
            {showEffect && (
                <div className="battle-particles">
                    {Array.from({ length: 10 }).map((_, i) => (
                        <div 
                            key={i}
                            className="particle"
                            style={{
                                '--delay': `${i * 0.1}s`,
                                '--angle': `${(i * 36)}deg`
                            }}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
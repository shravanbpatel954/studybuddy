import React, { useState, useEffect } from 'react';
import './QuizCard.css';

export default function QuizCard({ question, onAnswer, onNext }) {
    const [selectedAnswer, setSelectedAnswer] = useState(null);
    const [showExplanation, setShowExplanation] = useState(false);

    useEffect(() => {
        setSelectedAnswer(null);
        setShowExplanation(false);
    }, [question && question.id]);

    if (!question) return <div>Loading question...</div>;

    const handleSelect = (option) => {
        if (selectedAnswer) return; // Prevent multiple answers
        setSelectedAnswer(option);
        setShowExplanation(true);
        // Notify parent of the selected answer (parent will compute correctness/time)
        onAnswer({ selectedAnswer: option });
    };

    return (
        <div className="quiz-card-container">
            <div className="quiz-card-header">
                <h3 className="quiz-question-text">{question.question}</h3>
            </div>

            <div className="quiz-options-container">
                {question.options.map((option, index) => {
                    const isSelected = selectedAnswer === option;
                    const isCorrect = option === question.correctAnswer;
                    const optionClass = isSelected 
                        ? (isCorrect ? 'quiz-option-correct' : 'quiz-option-incorrect')
                        : 'quiz-option';
                    
                    return (
                        <button
                            key={index}
                            className={optionClass}
                            onClick={() => handleSelect(option)}
                            disabled={selectedAnswer !== null}
                        >
                            {option}
                        </button>
                    );
                })}
            </div>

            {showExplanation && (
                <div className="quiz-explanation">
                    <strong>Explanation:</strong> {question.explanation || `Answer: ${question.correctAnswer}`}
                    <div className="quiz-next-container">
                        <button
                            className="sb-pill-button"
                            onClick={() => onNext && onNext()}
                        >
                            Next
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

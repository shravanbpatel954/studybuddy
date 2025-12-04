import React from 'react';
import './DifficultyIndicator.css';

/**
 * Difficulty Indicator Component - Gradient Pill Button Style
 */
export default function DifficultyIndicator({ difficulty = 'beginner' }) {
  const difficultyLower = difficulty.toLowerCase();
  
  return (
    <div className="difficulty-indicator-wrapper">
      <span className="difficulty-label">Difficulty</span>
      <div className={`difficulty-pill difficulty-${difficultyLower}`}>
        <span className="difficulty-text">{difficulty}</span>
      </div>
    </div>
  );
}

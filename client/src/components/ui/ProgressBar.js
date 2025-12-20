import React from 'react';
import './ProgressBar.css';

/**
 * Reusable Progress Bar component with gradient and responsive design
 */
const ProgressBar = ({ 
  value = 0, 
  max = 100,
  showLabel = false,
  label = '',
  size = 'medium',
  variant = 'primary',
  className = '',
  ...props 
}) => {
  const percentage = Math.max(0, Math.min(100, (value / max) * 100));
  
  return (
    <div className={`progress-bar-wrapper progress-bar-${size} progress-bar-${variant} ${className}`} {...props}>
      {showLabel && label && (
        <div className="progress-bar-label">
          <span>{label}</span>
          <span>{Math.round(percentage)}%</span>
        </div>
      )}
      <div className="progress-bar-container">
        <div 
          className="progress-bar-fill"
          style={{ width: `${percentage}%` }}
          role="progressbar"
          aria-valuenow={value}
          aria-valuemin={0}
          aria-valuemax={max}
        />
      </div>
    </div>
  );
};

export default ProgressBar;


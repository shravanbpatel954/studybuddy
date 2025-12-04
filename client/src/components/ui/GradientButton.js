import React from 'react';
import './GradientButton.css';

/**
 * Reusable Gradient Button component with responsive tap targets
 */
const GradientButton = ({ 
  children, 
  onClick, 
  variant = 'primary',
  size = 'medium',
  disabled = false,
  className = '',
  type = 'button',
  ...props 
}) => {
  return (
    <button
      type={type}
      className={`gradient-btn gradient-btn-${variant} gradient-btn-${size} ${className}`}
      onClick={onClick}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
};

export default GradientButton;


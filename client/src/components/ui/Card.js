import React from 'react';
import './Card.css';

/**
 * Reusable Card component with glassmorphism and responsive design
 */
const Card = ({ 
  children, 
  className = '', 
  hover = false, 
  padding = '1.5rem',
  onClick,
  ...props 
}) => {
  return (
    <div 
      className={`ui-card ${hover ? 'ui-card-hover' : ''} ${className}`}
      style={{ padding }}
      onClick={onClick}
      {...props}
    >
      {children}
    </div>
  );
};

export default Card;


import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import './TopHeader.css';

const TopHeader = ({ showBackButton = false, title = 'StudyBuddy' }) => {
  const navigate = useNavigate();
  const token = localStorage.getItem('token');

  return (
    <header className="top-header">
      <div className="top-header-content">
        {showBackButton && (
          <button 
            className="top-header-back-btn"
            onClick={() => navigate(-1)}
            aria-label="Go back"
          >
            ←
          </button>
        )}
        <Link to={token ? "/dashboard" : "/"} className="top-header-logo">
          <img src="/logo.ico" alt="StudyBuddy" className="top-header-logo-icon" />
          <span className="top-header-title">{title}</span>
        </Link>
        <div className="top-header-spacer"></div>
      </div>
    </header>
  );
};

export default TopHeader;


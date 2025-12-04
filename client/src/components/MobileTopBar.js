import React from 'react';
import { 
  Menu,
  X
} from 'lucide-react';
import './MobileTopBar.css';

const MobileTopBar = ({ user, onMenuClick, drawerOpen, points, loadingPoints, onLeaderboardClick }) => {

  return (
    <div className="mobile-top-bar">
      <button 
        className="mobile-menu-btn"
        onClick={onMenuClick}
        aria-label="Toggle menu"
      >
        {drawerOpen ? <X size={24} /> : <Menu size={24} />}
      </button>

      <div className="mobile-logo">
        <img src="/logo.ico" alt="StudyBuddy" className="mobile-logo-icon" />
        <span className="mobile-logo-text">StudyBuddy</span>
      </div>

      <button 
        className="mobile-points"
        onClick={onLeaderboardClick || (() => {})}
        aria-label="Open leaderboard"
      >
        <span className="mobile-points-icon">🏆</span>
        <span className="mobile-points-value">{loadingPoints ? "..." : points}</span>
      </button>
    </div>
  );
};

export default MobileTopBar;


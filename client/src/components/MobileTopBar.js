import React, { useState, useEffect } from 'react';
import { 
  Menu,
  X
} from 'lucide-react';
import './MobileTopBar.css';

const MobileTopBar = ({ user, onMenuClick, drawerOpen, points, loadingPoints, onLeaderboardClick }) => {
  // FORCE RE-RENDER: Key-based remount to fix stale UI
  const [uiKey, setUiKey] = useState(0);
  
  const [showPointsBubble, setShowPointsBubble] = useState(false);
  const [pointsEarned, setPointsEarned] = useState(0);

  useEffect(() => {
    // FORCE RENDER: Listen for points updates
    const handler = (e) => {
      const detail = e.detail || {};
      const earned = detail.pointsEarned || detail.earned || 0;
      
      // FORCE SHOW points bubble if points were earned
      if (earned > 0) {
        setPointsEarned(earned);
        setShowPointsBubble(true);
        // FORCE RE-RENDER UI tree
        setUiKey(k => k + 1);
        setTimeout(() => {
          setShowPointsBubble(false);
        }, 1200);
      }
    };
    window.addEventListener('pointsUpdated', handler);
    return () => window.removeEventListener('pointsUpdated', handler);
  }, []);

  return (
    <div key={uiKey} className="mobile-top-bar">
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
        style={{ position: 'relative' }}
      >
        <span className="mobile-points-icon">🏆</span>
        <span className="mobile-points-value">{loadingPoints ? "..." : points}</span>
        {/* FORCE RENDER: Points bubble animation - MUST BE VISIBLE */}
        {showPointsBubble && pointsEarned > 0 && (
          <span className="points-bubble-animation" style={{ position: 'absolute', top: '-30px', right: '0', color: '#4ade80', fontWeight: 'bold', fontSize: '16px', pointerEvents: 'none', zIndex: 1000, textShadow: '0 2px 4px rgba(0, 0, 0, 0.5)', animation: 'floatUp 1.2s ease-out forwards' }}>
            +{pointsEarned}
          </span>
        )}
      </button>
    </div>
  );
};

export default MobileTopBar;


import React from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { 
  Menu, 
  X, 
  BookOpen, 
  Gamepad2, 
  MessageCircle, 
  Brain, 
  FileText, 
  User,
  Home,
  Trophy
} from "lucide-react";
import './Sidebar.css';

const Sidebar = ({ drawerOpen, toggleDrawer, user, logoutFn, points, loadingPoints }) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'home';

  // Icon mapping for each tab
  const tabIcons = {
    "home": Home,
    "modules": BookOpen,
    "games": Gamepad2,
    "chat": MessageCircle,
    "ai-doubt": Brain,
    "qpp": FileText,
    "leaderboard": Trophy,
    "profile": User
  };

  const tabs = ["home", "modules", "games", "chat", "ai-doubt", "qpp", "leaderboard", "profile"];

  const handleTabClick = (tab) => {
    navigate(`/dashboard?tab=${tab}`);
    // Only close drawer on mobile, keep open on desktop
    if (window.innerWidth <= 768) {
      toggleDrawer();
    }
  };

  return (
    <div className={`drawer-container ${drawerOpen ? "expanded" : "collapsed"}`}>
      <div className="drawer-header">
        {drawerOpen ? (
          <div className="logo">
            <img src="/logo.ico" alt="StudyBuddy Logo" className="logo-icon" />
            <span>StudyBuddy</span>
          </div>
        ) : (
          <img src="/logo.ico" alt="StudyBuddy" className="logo-icon-only" />
        )}
        <button
          className="drawer-toggle-btn"
          onClick={toggleDrawer}
          aria-label={drawerOpen ? "Collapse sidebar" : "Expand sidebar"}
        >
          {drawerOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      <div className="drawer-links">
        {tabs.map((tab) => {
          const Icon = tabIcons[tab];
          return (
            <button
              key={tab}
              className={`tab-button ${
                activeTab === tab ? "active" : ""
              }`}
              onClick={() => handleTabClick(tab)}
              title={drawerOpen ? "" : tab.charAt(0).toUpperCase() + tab.slice(1).replace("-", " ")}
            >
              <Icon size={drawerOpen ? 20 : 24} />
              {drawerOpen && (
                <span className="tab-label">
                  {tab.charAt(0).toUpperCase() + tab.slice(1).replace("-", " ")}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {drawerOpen && (
        <div className="drawer-footer">
          {/* Points Badge - Show on mobile in sidebar */}
          <div className="sidebar-points-badge">
            <span className="sidebar-points-icon">🏆</span>
            <div className="sidebar-points-info">
              <span className="sidebar-points-label">Points</span>
              <span className="sidebar-points-value">{loadingPoints ? "..." : (points || 0).toLocaleString()}</span>
            </div>
          </div>
          <span className="username">{user?.name || user?.displayName || 'User'}</span>
          <button className="logout-btn" onClick={logoutFn}>
            Logout
          </button>
        </div>
      )}
    </div>
  );
};

export default Sidebar;


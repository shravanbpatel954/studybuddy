import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import HeaderFooter from "./HeaderFooter";
import { useNavigate } from 'react-router-dom';
import {
  BookOpen,
  Brain,
  Trophy,
  Gamepad2,
  FileText,
  Sparkles,
  MessageCircle,
  ChevronRight,
  MoreVertical,
  Lock,
  Zap
} from 'lucide-react';
import api from '../services/api';
import useAuth from '../hooks/useAuth';
import { getUserPoints } from '../services/userService';
import './DashboardHome.css';

const DashboardHome = () => {
  const navigate = useNavigate();
  const { user, token } = useAuth();
  const [modules, setModules] = useState([]);
  const [points, setPoints] = useState(0);
  const [loading, setLoading] = useState(true);
  const [unlockedGames, setUnlockedGames] = useState(['Basket Hoop']); // Default: Basket Hoop is always unlocked
  const [allGames, setAllGames] = useState([]);

  useEffect(() => {
    fetchModules();
    fetchPoints();
    fetchGames();
  }, [token]);

  // Update unlockedGames when user data changes
  useEffect(() => {
    if (user?.unlockedGames && Array.isArray(user.unlockedGames) && user.unlockedGames.length > 0) {
      setUnlockedGames(user.unlockedGames);
    } else {
      // Default: at least Basket Hoop should be unlocked
      // Also calculate based on points: 100 points per game after the first
      const defaultUnlocked = ['Basket Hoop'];
      if (points >= 100) defaultUnlocked.push('GTA Simulator');
      if (points >= 200) defaultUnlocked.push('Madalin Stunt Cars Pro');
      if (points >= 300) defaultUnlocked.push('Masked Special Forces');
      setUnlockedGames(defaultUnlocked);
    }
  }, [user, points]);

  const fetchModules = async () => {
    try {
      const res = await api.get('/auth/modules');
      if (res && res.success) {
        setModules(res.modules || []);
      }
    } catch (err) {
      console.error('Failed to fetch modules:', err);
      // Don't set loading to false on error to prevent UI flicker
      // The error is logged but we continue with empty modules array
    }
  };

  const fetchPoints = async () => {
    try {
      const res = await getUserPoints();
      if (res?.success) {
        setPoints(res.points || 0);
      }
    } catch (err) {
      console.error('Failed to fetch points:', err);
    }
  };

  const fetchGames = async () => {
    // Use the actual games list (matching GamesPage)
    // These are the actual playable games, not missions
    const actualGames = [
        { name: 'Basket Hoop' },
        { name: 'GTA Simulator' },
        { name: 'Madalin Stunt Cars Pro' },
      { name: 'Masked Special Forces' },
      { name: 'Drift King' },
      { name: 'Cookie Clicker Pro' },
      { name: 'Jungle Sniper' },
      { name: 'Traffic Control' }
    ];
    setAllGames(actualGames);
    // unlockedGames will be set by the useEffect that watches user changes
  };

  const calculateProgress = (module) => {
    if (!module.chapters || module.chapters.length === 0) return 0;
    const totalSubsections = module.chapters.reduce((acc, ch) => {
      return acc + (ch.sections?.reduce((sAcc, sec) => sAcc + (sec.subsections?.length || 0), 0) || 0);
    }, 0);
    return totalSubsections > 0 ? Math.round((module.completedSubsections || 0) / totalSubsections * 100) : 0;
  };

  const getLastAccessedModule = () => {
    if (!modules || modules.length === 0) return null;
    // Return first module for now, can be enhanced with lastAccessed timestamp
    return modules[0];
  };

  const quickActions = [
    {
      icon: FileText,
      label: 'Modules',
      action: () => navigate('/dashboard?tab=modules'),
      color: '#4B8BFF'
    },
    {
      icon: Brain,
      label: 'AI Doubt Solver',
      action: () => navigate('/dashboard?tab=ai-doubt'),
      color: '#7B5CFF'
    },
    {
      icon: MessageCircle,
      label: 'Chat',
      action: () => navigate('/dashboard?tab=chat'),
      color: '#4B8BFF'
    },
    {
      icon: Trophy,
      label: 'Leaderboard',
      action: () => navigate('/dashboard?tab=leaderboard'),
      color: '#7B5CFF'
    }
  ];

  const continueModule = getLastAccessedModule();
  const lockedGamesCount = allGames.length - unlockedGames.length;
  const pointsNeeded = lockedGamesCount * 100;

  return (
    <HeaderFooter>
    <div className="dashboard-home">
      <div className="dashboard-container">
        {/* Welcome Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="welcome-header"
      >
        <div className="welcome-content">
          <h1 className="welcome-title">
            Welcome back, <span className="welcome-name">{user?.displayName || user?.name || 'Student'}</span>
          </h1>
          <p className="welcome-subtitle">Continue your learning journey</p>
          {/* XP Bar */}
          <div className="xp-bar-container">
            <div className="xp-bar-label">
              <span>Level {Math.floor(points / 1000) + 1}</span>
              <span>{points % 1000} / 1000 XP</span>
            </div>
            <div className="xp-bar-wrapper">
              <motion.div
                className="xp-bar-fill"
                initial={{ width: 0 }}
                animate={{ width: `${((points % 1000) / 1000) * 100}%` }}
                transition={{ duration: 1, delay: 0.3 }}
              />
            </div>
          </div>
        </div>
        <div className="points-badge">
          <Trophy size={20} />
          <div className="points-info">
            <span className="points-value">{points.toLocaleString()}</span>
            <span className="points-label">Points</span>
          </div>
        </div>
      </motion.div>

      {/* Quick Actions Row */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="quick-actions"
      >
        {quickActions.map((action, idx) => {
          const Icon = action.icon;
          return (
            <motion.button
              key={idx}
              whileHover={{ scale: 1.05, y: -2 }}
              whileTap={{ scale: 0.95 }}
              className="quick-action-card"
              onClick={action.action}
              style={{ '--accent-color': action.color }}
            >
              <div className="action-icon-wrapper">
                <Icon size={24} />
              </div>
              <span className="action-label">{action.label}</span>
            </motion.button>
          );
        })}
      </motion.div>

      {/* Continue Studying Section */}
      {continueModule && (
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="continue-card"
        >
          {/* Left Section: Icon + Title + Chapters */}
          <div className="continue-left">
            <div className="continue-icon">
              <BookOpen size={24} />
            </div>
            <div className="continue-text-info">
              <h3 className="continue-title">{continueModule.subject}</h3>
              <p className="continue-meta">
                {continueModule.chapters?.length || 0} chapters
              </p>
            </div>
          </div>

          {/* Middle Section: Progress Bar */}
          <div className="continue-middle">
            <div className="continue-progress-wrapper">
              <div className="progress-bar-container">
                <motion.div
                  className="progress-bar-fill"
                  initial={{ width: 0 }}
                  animate={{ width: `${calculateProgress(continueModule)}%` }}
                  transition={{ duration: 1, delay: 0.5 }}
                />
              </div>
              <span className="progress-percentage">{calculateProgress(continueModule)}%</span>
            </div>
          </div>

          {/* Right Section: Continue Button */}
          <div className="continue-right">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="continue-btn"
              onClick={() => navigate(`/dashboard?tab=modules&moduleId=${continueModule._id}`)}
            >
              Continue
              <ChevronRight size={18} />
            </motion.button>
          </div>
        </motion.div>
      )}

      {/* QPP Predictor Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.3 }}
        className="qpp-card"
      >
        <div className="qpp-icon-wrapper">
          <FileText size={28} />
          <Sparkles size={16} className="qpp-sparkle" />
        </div>
        <div className="qpp-content">
          <h3 className="qpp-title">Question Paper Predictor</h3>
          <p className="qpp-subtitle">Upload syllabus + previous papers to generate question papers</p>
        </div>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="qpp-btn"
          onClick={() => navigate('/dashboard?tab=qpp')}
        >
          Generate
        </motion.button>
      </motion.div>

      {/* Gamification Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="games-section"
        >
          <div className="section-header">
            <h2 className="section-title">Unlock Games</h2>
            <p className="section-subtitle">
            {allGames.length === 0 
              ? 'Loading games...'
              : pointsNeeded > 0 
                ? `Earn ${pointsNeeded} more points to unlock ${lockedGamesCount} game${lockedGamesCount > 1 ? 's' : ''}`
                : 'All games unlocked! 🎉'
              }
            </p>
          </div>
        {allGames.length === 0 ? (
          <div className="games-loading-state">
            <Gamepad2 size={32} />
            <p>Loading games...</p>
          </div>
        ) : (
          <div className="games-grid-mini">
            {allGames.slice(0, 4).map((game, idx) => {
              // Get game name - handle both 'name' and 'title' properties
              const gameName = game.name || game.title || '';
              // Check if unlocked (case-insensitive comparison)
              // Always unlock Basket Hoop, then check user's unlockedGames
              const isUnlocked = gameName.toLowerCase() === 'basket hoop' || 
                unlockedGames.some(
                  unlocked => unlocked.toLowerCase() === gameName.toLowerCase()
                );
              return (
                <motion.div
                  key={idx}
                  whileHover={{ scale: 1.05, rotate: isUnlocked ? 0 : [0, -2, 2, -2, 0] }}
                  whileTap={{ scale: 0.95 }}
                  className={`game-card-mini ${isUnlocked ? 'unlocked' : 'locked'}`}
                  onClick={() => isUnlocked && navigate('/dashboard?tab=games')}
                  style={{ cursor: isUnlocked ? 'pointer' : 'not-allowed' }}
                >
                  {isUnlocked ? (
                    <Gamepad2 size={24} />
                  ) : (
                    <Lock size={24} />
                  )}
                  <span className="game-name-mini">{gameName}</span>
                  {!isUnlocked && (
                    <span className="game-lock-hint">Locked</span>
                  )}
                </motion.div>
              );
            })}
          </div>
        )}
        {allGames.length > 4 && (
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
            className="view-all-games-btn"
            onClick={() => navigate('/dashboard?tab=games')}
                >
            View All Games
            <ChevronRight size={18} />
                </motion.button>
        )}
      </motion.div>
      </div>

      {/* Floating Chat Button */}
      <motion.button
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ delay: 0.6, type: 'spring' }}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        className="floating-chat-btn"
        onClick={() => navigate('/dashboard?tab=chat')}
        title="Global Chatroom"
      >
        <MessageCircle size={24} />
      </motion.button>
    </div>
    </HeaderFooter>

  );
};

export default DashboardHome;


import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import GlobalChat from "../components/GlobalChat";
import GamesPage from "./GamesPage";
import ProfilePage from "./ProfilePage";
import ModulesPage from "./ModulesPage";
import AiDoubtSolverPage from "./AiDoubtSolverPage";
import QPPPage from "./QPPPage";
import LeaderboardPage from "./LeaderboardPage";
import DashboardHome from "../components/DashboardHome";
import Sidebar from "../components/Sidebar";
import MobileBottomNav from "../components/MobileBottomNav";
import MobileTopBar from "../components/MobileTopBar";
import LeaderboardModal from "../components/LeaderboardModal";
import "./Dashboard.css";
import { getUserPoints } from "../services/userService";
import useAuth from "../hooks/useAuth";

const Dashboard = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, token, logout } = useAuth();
  const [activeTab, setActiveTab] = useState(() => {
    const tab = searchParams.get('tab');
    return tab || 'home';
  });

  const [drawerOpen, setDrawerOpen] = useState(false);
  // NOTE: Avoid forced remounts; they were resetting in-progress quiz UI
  const [uiKey] = useState(0);
  
  const [points, setPoints] = useState(0);
  const [loadingPoints, setLoadingPoints] = useState(true);
  const [showLeaderboardModal, setShowLeaderboardModal] = useState(false);
  const [showPointsBubble, setShowPointsBubble] = useState(false);
  const [pointsEarned, setPointsEarned] = useState(0);

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab) {
      setActiveTab(tab);
      // Close quiz UI when tab changes
      window.dispatchEvent(new CustomEvent('closeQuizUI'));
    }
  }, [searchParams]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (showLeaderboardModal) {
      document.body.classList.add('modal-open');
    } else {
      document.body.classList.remove('modal-open');
    }
    return () => {
      document.body.classList.remove('modal-open');
    };
  }, [showLeaderboardModal]);

  useEffect(() => {
    // Only redirect if token is explicitly removed (not just missing temporarily)
    const storedToken = localStorage.getItem('token');
    if (!token && !storedToken) {
      navigate("/");
    }
  }, [token, navigate]);

  useEffect(() => {
    let mounted = true;
    async function fetchPoints() {
      try {
        setLoadingPoints(true);
        const res = await getUserPoints();
        console.log('Dashboard fetchPoints response:', res); // Debug log
        if (!mounted) return;
        if (res?.success && typeof res.points === "number") {
          setPoints(res.points);
          console.log('Points updated to:', res.points); // Debug log
        }
      } catch (err) {
        console.error('Dashboard fetchPoints error:', err); // Debug log
        if (mounted) setPoints(0);
      } finally {
        if (mounted) setLoadingPoints(false);
      }
    }
    if (token) {
      fetchPoints();
      console.log('Fetching points with token:', token); // Debug log
    }

    // FORCE RENDER: Listen for global points update events (dispatched by quiz/game components)
    const handler = async (e) => {
      console.log('[Dashboard] pointsUpdated event received:', e.detail);
      const detail = e.detail || {};
      const earned = detail.pointsEarned || detail.earned || 0;
      
      // FORCE SHOW points bubble animation if points were earned
      if (earned > 0) {
        setPointsEarned(earned);
        setShowPointsBubble(true);
        // Hide animation after 1.2 seconds
        setTimeout(() => {
          setShowPointsBubble(false);
        }, 1200);
      }
      
      // FORCE REFRESH points from server immediately
      try {
        setLoadingPoints(true);
        await fetchPoints();
        console.log('[Dashboard] Points refreshed after event');
      } catch (err) {
        console.warn('pointsUpdated handler failed', err);
      } finally {
        setLoadingPoints(false);
      }
    };
    window.addEventListener('pointsUpdated', handler);
    console.log('[Dashboard] Registered pointsUpdated event listener');

    return () => {
      mounted = false;
      window.removeEventListener('pointsUpdated', handler);
    };
  }, [token]);

    const logoutFn = async () => {
    try {
      const apiBase = process.env.REACT_APP_API_BASE || 'https://studybuddy-backend-i649.onrender.com/api/v1';
      await fetch(`${apiBase}/auth/logout`, {
        method: "POST",
        headers: {
          Authorization: "Bearer " + token,
          "Content-Type": "application/json",
        },
      });
    } catch (err) {
      console.error(err);
    } finally {
      // Clear all authentication data
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      localStorage.removeItem("userId");
      localStorage.removeItem("userName");
      localStorage.removeItem("userEmail");
      localStorage.removeItem("userPhoto");
      
      // Clear auth state using useAuth hook
      if (logout) {
        logout();
      }
      
      navigate("/");
      // Force page reload to clear all state
      window.location.reload();
    }
  };

  const toggleDrawer = () => {
    setDrawerOpen(prev => !prev);
  };

  return (
    <div key={uiKey} className={`dashboard ${drawerOpen ? "shifted" : ""}`}>
      {/* Mobile Top Bar */}
      <MobileTopBar 
        user={user} 
        onMenuClick={toggleDrawer}
        drawerOpen={drawerOpen}
        points={points}
        loadingPoints={loadingPoints}
        onLeaderboardClick={() => setShowLeaderboardModal(true)}
      />

      {/* Top-right points display (Desktop only) - FORCE RENDER POINTS BUBBLE */}
      <div className="top-right">
        <div className="dashboard-top-bar" style={{ position: 'relative' }}>
          <span className="points-label">🏆 Points:</span>
          <span className="points-value">{loadingPoints ? "..." : points}</span>
          {/* Points bubble removed from here - now rendered globally below */}
        </div>
      </div>

      {/* Overlay for mobile */}
      {drawerOpen && window.innerWidth <= 768 && (
        <div 
          className="drawer-overlay" 
          onClick={toggleDrawer}
          aria-label="Close sidebar"
        />
      )}

      {/* Sidebar - Always visible, collapsed or expanded */}
      <Sidebar 
        drawerOpen={drawerOpen}
        toggleDrawer={toggleDrawer}
        user={user}
        logoutFn={logoutFn}
        points={points}
        loadingPoints={loadingPoints}
      />

      {/* Content shifts when drawer opens */}
      <div className="dashboard-content">
        {activeTab === "home" && <DashboardHome />}
        {activeTab === "modules" && <ModulesPage />}
        {activeTab === "games" && <GamesPage />}
        {activeTab === "chat" && <GlobalChat />}
        {activeTab === "ai-doubt" && <AiDoubtSolverPage />}
        {activeTab === "qpp" && <QPPPage />}
        {activeTab === "leaderboard" && <LeaderboardPage />}
        {activeTab === "profile" && <ProfilePage />}
      </div>

      {/* Mobile Bottom Navigation */}
      <MobileBottomNav />

      {/* Leaderboard Modal */}
      <LeaderboardModal 
        isOpen={showLeaderboardModal}
        onClose={() => setShowLeaderboardModal(false)}
      />

      {/* Global Points Bubble Animation - More visible position */}
      {showPointsBubble && pointsEarned > 0 && (
        <div className="points-bubble-animation">
          +{pointsEarned} 🎉
        </div>
      )}
    </div>
  );
};

export default Dashboard;

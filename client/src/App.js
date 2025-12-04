import React, { useEffect, useState } from 'react';
import { Route, Routes, Navigate, useNavigate } from 'react-router-dom';
import Login from './page/Login';
import Signup from './page/Signup';
import Success from './page/Success';
import Dashboard from './page/Dashboard';
import ResetPassword from './page/ResetPassword';
import LandingPage from './page/StudyBuddyLanding';
import ProtectedRoute from './components/ProtectedRoute';
import ModulesPage from './page/ModulesPage';
import ChatPage from './page/ChatPage';
import ProfilePage from './page/ProfilePage';
import GamesPage from './page/GamesPage';
import LeaderboardPage from './page/LeaderboardPage';
import PWAInstallPrompt from './components/PWAInstallPrompt';
import PWASplashScreen from './components/PWASplashScreen';

// Function to detect if app is running as PWA (installed app)
const isPWA = () => {
  // Check for standalone display mode (most reliable)
  if (window.matchMedia('(display-mode: standalone)').matches) {
    return true;
  }
  // Check for iOS Safari standalone mode
  if (window.navigator.standalone === true) {
    return true;
  }
  // Check for fullscreen mode (another PWA indicator)
  if (window.matchMedia('(display-mode: fullscreen)').matches) {
    return true;
  }
  // Check if launched from home screen (Android Chrome)
  if (window.matchMedia('(display-mode: minimal-ui)').matches) {
    return true;
  }
  return false;
};

const App = () => {
  const token = localStorage.getItem('token');
  const navigate = useNavigate();
  const [isPWAInstalled, setIsPWAInstalled] = useState(false);
  const [showSplash, setShowSplash] = useState(() => {
    // Only show splash if not shown before
    return !localStorage.getItem('pwa-splash-shown');
  });

  // Detect PWA on mount
  useEffect(() => {
    setIsPWAInstalled(isPWA());
  }, []);

  // If an OAuth flow set a post-login redirect and we already have a token, navigate there
  useEffect(() => {
    try {
      const redirect = localStorage.getItem('postLoginRedirect');
      if (redirect && token) {
        localStorage.removeItem('postLoginRedirect');
        navigate(redirect);
      }
    } catch (e) {
      // ignore
    }
  }, [token, navigate]);

  // ...existing code...

  // Determine root route: PWA shows login, regular web shows landing page
  const getRootElement = () => {
    if (token) {
      return <Navigate to="/dashboard" />;
    }
    // If PWA is installed, show login page; otherwise show landing page
    return isPWAInstalled ? <Navigate to="/login" /> : <LandingPage />;
  };

  if (showSplash) {
    return <PWASplashScreen onComplete={() => setShowSplash(false)} />;
  }

  return (
    <>
      <PWAInstallPrompt />
      {/* Points bar is rendered inside Dashboard now */}
      <Routes>
        <Route path="/" element={getRootElement()} />
        <Route path="/dashboard" element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        } />
        <Route path="/modules" element={
          <ProtectedRoute>
            <ModulesPage />
          </ProtectedRoute>
        } />
        <Route path="/chat" element={
          <ProtectedRoute>
            <ChatPage />
          </ProtectedRoute>
        } />
        <Route path="/profile" element={
          <ProtectedRoute>
            <ProfilePage />
          </ProtectedRoute>
        } />
        <Route path="/games" element={
          <ProtectedRoute>
            <GamesPage />
          </ProtectedRoute>
        } />
        <Route path="/leaderboard" element={
          <ProtectedRoute>
            <LeaderboardPage />
          </ProtectedRoute>
        } />
        <Route path="/login" element={token ? <Navigate to="/dashboard" /> : <Login />} />
        <Route path="/signup" element={token ? <Navigate to="/dashboard" /> : <Signup />} />
        <Route path="/success" element={<Success />} />
        <Route path="/reset-password" element={<ResetPassword />} />
      </Routes>
    </>
  );
};

export default App;

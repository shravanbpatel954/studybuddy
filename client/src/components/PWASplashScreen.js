import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import './PWASplashScreen.css';

const PWASplashScreen = ({ onComplete }) => {
  const [progress, setProgress] = useState(0);
  const [showContent, setShowContent] = useState(false);

  useEffect(() => {
    // Check if splash was already shown
    const splashShown = localStorage.getItem('pwa-splash-shown');
    if (splashShown === 'true') {
      onComplete();
      return;
    }

    // Animate progress bar
    const progressInterval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(progressInterval);
          setTimeout(() => {
            setShowContent(true);
            localStorage.setItem('pwa-splash-shown', 'true');
            setTimeout(() => {
              onComplete();
            }, 1500);
          }, 300);
          return 100;
        }
        return prev + 2;
      });
    }, 30);

    return () => clearInterval(progressInterval);
  }, [onComplete]);

  return (
    <motion.div
      className="pwa-splash"
      initial={{ opacity: 1 }}
      animate={{ opacity: showContent ? 0 : 1 }}
      transition={{ duration: 0.5 }}
    >
      <div className="splash-background">
        <div className="splash-gradient"></div>
        <div className="splash-particles">
          {[...Array(20)].map((_, i) => (
            <div key={i} className="particle" style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 2}s`,
              animationDuration: `${3 + Math.random() * 2}s`
            }}></div>
          ))}
        </div>
      </div>

      <div className="splash-content">
        <motion.div
          className="splash-logo-container"
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        >
          <div className="splash-logo-wrapper">
            <motion.img
              src="/logo.ico"
              alt="StudyBuddy"
              className="splash-logo"
              animate={{
                rotate: [0, 360],
                scale: [1, 1.1, 1]
              }}
              transition={{
                rotate: { duration: 2, repeat: Infinity, ease: "linear" },
                scale: { duration: 2, repeat: Infinity, ease: "easeInOut" }
              }}
            />
            <div className="splash-logo-glow"></div>
          </div>
        </motion.div>

        <motion.h1
          className="splash-title"
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.6 }}
        >
          StudyBuddy
        </motion.h1>

        <motion.p
          className="splash-subtitle"
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.5, duration: 0.6 }}
        >
          Your Intelligent Learning Companion
        </motion.p>

        <div className="splash-progress-container">
          <div className="splash-progress-bar">
            <motion.div
              className="splash-progress-fill"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
          <motion.span
            className="splash-progress-text"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
          >
            {progress}%
          </motion.span>
        </div>

        <motion.div
          className="splash-loading-dots"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
        >
          <span></span>
          <span></span>
          <span></span>
        </motion.div>
      </div>
    </motion.div>
  );
};

export default PWASplashScreen;


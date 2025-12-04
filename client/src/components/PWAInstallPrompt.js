import React, { useState, useEffect } from 'react';
import { X, Download } from 'lucide-react';
import './PWAInstallPrompt.css';

const PWAInstallPrompt = () => {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  // Check if app is already installed
  useEffect(() => {
    const checkIfInstalled = () => {
      // Check for standalone display mode
      if (window.matchMedia('(display-mode: standalone)').matches) {
        setIsInstalled(true);
        return;
      }
      // Check for iOS Safari standalone mode
      if (window.navigator.standalone === true) {
        setIsInstalled(true);
        return;
      }
      // Check for fullscreen mode
      if (window.matchMedia('(display-mode: fullscreen)').matches) {
        setIsInstalled(true);
        return;
      }
      // Check if launched from home screen (Android Chrome)
      if (window.matchMedia('(display-mode: minimal-ui)').matches) {
        setIsInstalled(true);
        return;
      }
    };

    checkIfInstalled();
  }, []);

  // Listen for the beforeinstallprompt event
  useEffect(() => {
    const handler = (e) => {
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault();
      // Stash the event so it can be triggered later
      setDeferredPrompt(e);
      // Show our custom install prompt
      const hasSeenPrompt = localStorage.getItem('pwa-install-prompt-seen');
      if (!hasSeenPrompt && !isInstalled) {
        setShowPrompt(true);
      }
    };

    window.addEventListener('beforeinstallprompt', handler);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, [isInstalled]);

  const handleInstallClick = async () => {
    if (!deferredPrompt) {
      // Fallback for iOS Safari
      if (/iPad|iPhone|iPod/.test(navigator.userAgent)) {
        alert('To install this app on your iOS device, tap the Share button and then "Add to Home Screen".');
      } else {
        alert('Installation is not available. Please check your browser settings.');
      }
      return;
    }

    // Show the install prompt
    deferredPrompt.prompt();

    // Wait for the user to respond to the prompt
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === 'accepted') {
      console.log('User accepted the install prompt');
    } else {
      console.log('User dismissed the install prompt');
    }

    // Clear the deferredPrompt
    setDeferredPrompt(null);
    setShowPrompt(false);
    localStorage.setItem('pwa-install-prompt-seen', 'true');
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    localStorage.setItem('pwa-install-prompt-seen', 'true');
  };

  // Don't show if already installed or prompt not available
  if (isInstalled || !showPrompt) {
    return null;
  }

  return (
    <div className="pwa-install-prompt">
      <div className="pwa-install-content">
        <div className="pwa-install-icon">
          <Download size={24} />
        </div>
        <div className="pwa-install-text">
          <h3>Install StudyBuddy</h3>
          <p>Add to your home screen for a better experience</p>
        </div>
        <div className="pwa-install-actions">
          <button 
            className="pwa-install-btn"
            onClick={handleInstallClick}
          >
            Install
          </button>
          <button 
            className="pwa-dismiss-btn"
            onClick={handleDismiss}
            aria-label="Dismiss"
          >
            <X size={18} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default PWAInstallPrompt;


import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { 
  Home, 
  BookOpen, 
  Brain,
  Gamepad2, 
  FileText
} from 'lucide-react';
import './MobileBottomNav.css';

const MobileBottomNav = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'home';
  const [isVisible, setIsVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);

  const navItems = [
    { id: 'home', icon: Home, label: 'Home' },
    { id: 'modules', icon: BookOpen, label: 'Modules' },
    { id: 'ai-doubt', icon: Brain, label: 'AI Doubt' },
    { id: 'games', icon: Gamepad2, label: 'Games' },
    { id: 'qpp', icon: FileText, label: 'QPP' }
  ];

  const handleNavClick = (tabId, e) => {
    e.preventDefault();
    navigate(`/dashboard?tab=${tabId}`);
    // Close any active quiz UI by dispatching event
    window.dispatchEvent(new CustomEvent('closeQuizUI'));
  };

    // Scroll detection for hide/show behavior (LinkedIn-style) - Enhanced for all pages
  useEffect(() => {
    let ticking = false;
    const threshold = 3; // Lower threshold for smoother response
    let scrollTimeout = null;

    const getMaxScrollPosition = () => {
      // Get scroll position from window
      const windowScroll = window.scrollY || window.pageYOffset || document.documentElement.scrollTop;
      
      // Check all possible scrollable containers
      const scrollableSelectors = [
        '.dashboard-content',
        '.modules-page',
        '.module-view',
        '.module-main-content',
        '.content-area',
        '.quiz-section',
        '.materials-section',
        '.messages-container',
        '[data-scroll-container]',
        'main',
        'article',
        '.scroll-container'
      ];
      
      let maxScroll = windowScroll;
      
      scrollableSelectors.forEach(selector => {
        try {
          const containers = document.querySelectorAll(selector);
          containers.forEach(container => {
            const containerScroll = container.scrollTop || 0;
            if (containerScroll > maxScroll) {
              maxScroll = containerScroll;
            }
          });
        } catch (e) {
          // Ignore selector errors
        }
      });
      
      return maxScroll;
    };

    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const currentScrollY = getMaxScrollPosition();
          const scrollDelta = currentScrollY - lastScrollY;
          
          // Clear any existing timeout
          if (scrollTimeout) {
            clearTimeout(scrollTimeout);
          }
          
          // Only hide/show if scrolled more than threshold
          if (Math.abs(scrollDelta) > threshold) {
            if (scrollDelta > 0 && currentScrollY > 50) {
              // Scrolling down - hide nav immediately
              setIsVisible(false);
            } else if (scrollDelta < 0) {
              // Scrolling up - show nav immediately
              setIsVisible(true);
            }
            setLastScrollY(currentScrollY);
          }
          
          // Always show nav at the top of the page
          if (currentScrollY < 30) {
            setIsVisible(true);
          }
          
          // NO timeout - LinkedIn-style: hide on scroll down, show on scroll up
          // Removed the setTimeout that was causing nav to reappear after 2 seconds
          
          ticking = false;
        });
        ticking = true;
      }
    };

    // Listen to scroll events on window
    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('touchmove', handleScroll, { passive: true });
    
    // Also listen to scroll events on all scrollable containers
    const updateScrollListeners = () => {
      const scrollableSelectors = [
        '.dashboard-content',
        '.modules-page',
        '.module-view',
        '.module-main-content',
        '.content-area',
        '.quiz-section',
        '.materials-section',
        '.messages-container',
        '[data-scroll-container]'
      ];
      
      const containers = [];
      scrollableSelectors.forEach(selector => {
        try {
          document.querySelectorAll(selector).forEach(container => {
            if (!containers.includes(container)) {
              containers.push(container);
              container.addEventListener('scroll', handleScroll, { passive: true });
              container.addEventListener('touchmove', handleScroll, { passive: true });
            }
          });
        } catch (e) {
          // Ignore selector errors
        }
      });
      
      return containers;
    };

    // Initial setup
    const containers = updateScrollListeners();
    
    // Update listeners when DOM changes (for dynamic content)
    const observer = new MutationObserver(() => {
      updateScrollListeners();
    });
    
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('touchmove', handleScroll);
      containers.forEach(container => {
        container.removeEventListener('scroll', handleScroll);
        container.removeEventListener('touchmove', handleScroll);
      });
      observer.disconnect();
      if (scrollTimeout) {
        clearTimeout(scrollTimeout);
      }
    };
  }, [lastScrollY]);

  return (
    <nav className={`mobile-bottom-nav ${isVisible ? 'visible' : 'hidden'}`}>
      <div className="mobile-bottom-nav-container">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              className={`mobile-nav-item ${isActive ? 'active' : ''}`}
              onClick={(e) => handleNavClick(item.id, e)}
              aria-label={item.label}
            >
              <div className="mobile-nav-icon-wrapper">
                <Icon size={22} />
              </div>
              <span className="mobile-nav-label">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default MobileBottomNav;



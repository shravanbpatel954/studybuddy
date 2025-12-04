import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, X, FileText, Brain, BookOpen } from 'lucide-react';
import './FloatingButton.css';

const FloatingButton = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [isOpen, setIsOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const menuRef = useRef(null);
  const buttonRef = useRef(null);

  // Check if mobile on mount and resize
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
      // Close menu if switching to desktop
      if (window.innerWidth >= 768) {
        setIsOpen(false);
      }
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Close menu on route change
  useEffect(() => {
    setIsOpen(false);
  }, [searchParams]);

  // Close menu on scroll
  useEffect(() => {
    const handleScroll = () => {
      if (isOpen) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      window.addEventListener('scroll', handleScroll, { passive: true });
      return () => window.removeEventListener('scroll', handleScroll);
    }
  }, [isOpen]);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        isOpen &&
        menuRef.current &&
        buttonRef.current &&
        !menuRef.current.contains(event.target) &&
        !buttonRef.current.contains(event.target)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
        document.removeEventListener('touchstart', handleClickOutside);
      };
    }
  }, [isOpen]);

  const quickActions = [
    {
      id: 'qpp',
      icon: FileText,
      label: 'QPP',
      fullLabel: 'Question Paper Predictor',
      action: () => {
        navigate('/dashboard?tab=qpp');
        setIsOpen(false);
      }
    },
    {
      id: 'ai-doubt',
      icon: Brain,
      label: 'AI Doubt',
      fullLabel: 'AI Doubt Solver',
      action: () => {
        navigate('/dashboard?tab=ai-doubt');
        setIsOpen(false);
      }
    },
    {
      id: 'new-module',
      icon: BookOpen,
      label: 'New Module',
      fullLabel: 'Create New Module',
      action: () => {
        navigate('/dashboard?tab=modules');
        setIsOpen(false);
        // ModulesPage will handle the navigation
      }
    }
  ];

  const toggleMenu = (e) => {
    e.stopPropagation();
    setIsOpen(!isOpen);
  };

  // Don't render on desktop
  if (!isMobile) {
    return null;
  }

  return (
    <>
      {/* Backdrop blur when menu is open */}
      {isOpen && <div className="fab-backdrop" onClick={() => setIsOpen(false)} />}

      {/* Floating Action Button */}
      <button
        ref={buttonRef}
        className={`fab-button ${isOpen ? 'open' : ''}`}
        onClick={toggleMenu}
        aria-label={isOpen ? 'Close quick actions menu' : 'Open quick actions menu'}
        aria-expanded={isOpen}
      >
        {isOpen ? <X size={24} /> : <Plus size={24} />}
      </button>

      {/* Circular Pop-up Menu */}
      <div
        ref={menuRef}
        className={`fab-menu ${isOpen ? 'open' : ''}`}
        role="menu"
        aria-hidden={!isOpen}
      >
        {quickActions.map((action, index) => {
          const Icon = action.icon;
          const angle = (index * 120) - 90; // 120 degrees apart, starting from top
          const radius = 80; // Distance from center
          const x = Math.cos((angle * Math.PI) / 180) * radius;
          const y = Math.sin((angle * Math.PI) / 180) * radius;

          return (
            <button
              key={action.id}
              className="fab-menu-item"
              onClick={action.action}
              style={{
                '--x': `${x}px`,
                '--y': `${y}px`,
                '--delay': `${index * 0.05}s`
              }}
              aria-label={action.fullLabel}
            >
              <div className="fab-menu-item-icon">
                <Icon size={20} />
              </div>
              <span className="fab-menu-item-label">{action.label}</span>
            </button>
          );
        })}
      </div>
    </>
  );
};

export default FloatingButton;


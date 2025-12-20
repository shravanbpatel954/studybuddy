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

  // Completely hide floating button - removed per user request
  return null;
};

export default FloatingButton;


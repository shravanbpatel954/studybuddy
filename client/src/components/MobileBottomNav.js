import React from 'react';
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

  return (
    <nav className="mobile-bottom-nav">
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



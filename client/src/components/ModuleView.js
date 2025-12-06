import React, { useState, useEffect } from 'react';
import './ModuleView.css';
import GameSession from './GameSession';
import BasicChat from './BasicChat';
import { ChevronDown, ChevronUp, Menu, X, MessageCircle, BookOpen } from 'lucide-react';

const ModuleView = ({ module }) => {
    const [selectedSubsection, setSelectedSubsection] = useState(null);
    const [showQuiz, setShowQuiz] = useState(false);
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [showChat, setShowChat] = useState(false);
    const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
    const [expandedChapter, setExpandedChapter] = useState(0);
    const [fullscreenMode, setFullscreenMode] = useState(false);

    useEffect(() => {
        const handleResize = () => {
            setIsMobile(window.innerWidth <= 768);
            if (window.innerWidth > 768) {
                setSidebarOpen(true);
            }
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Close quiz UI when navigating away
    useEffect(() => {
        const handleCloseQuiz = () => {
            setShowQuiz(false);
        };
        window.addEventListener('closeQuizUI', handleCloseQuiz);
        return () => window.removeEventListener('closeQuizUI', handleCloseQuiz);
    }, []);

    // Handle fullscreen mode for mobile
    useEffect(() => {
        if (selectedSubsection && isMobile) {
            setFullscreenMode(true);
        }
    }, [selectedSubsection, isMobile]);

    const toggleChapter = (idx) => {
        setExpandedChapter(expandedChapter === idx ? -1 : idx);
    };

    const handleSelectSubsection = (subsection) => {
        setSelectedSubsection(subsection);
        if (isMobile) {
            setSidebarOpen(false);
        }
    };

    const handleBackToModules = () => {
        setSelectedSubsection(null);
        setFullscreenMode(false);
        setSidebarOpen(true);
    };

    const renderSidebar = () => (
        <div className={`module-sidebar ${sidebarOpen ? 'open' : 'closed'} ${isMobile && fullscreenMode ? 'hidden-mobile' : ''}`}>
            <div className="sidebar-header">
                <div className="module-info">
                    <h2>{module.subject}</h2>
                    <div className="progress-indicator">
                        <div className="progress-bar">
                            <div 
                                className="progress" 
                                style={{ width: `${module.progress || 0}%` }}
                            ></div>
                        </div>
                        <span>{module.progress || 0}% Complete</span>
                    </div>
                </div>
                {isMobile && (
                    <button 
                        className="close-sidebar-btn"
                        onClick={() => setSidebarOpen(false)}
                    >
                        <X size={20} />
                    </button>
                )}
            </div>
            
            <nav className="module-nav">
                {module.chapters?.map((chapter, idx) => (
                    <div key={idx} className="chapter-group">
                        <button 
                            className="chapter-toggle"
                            onClick={() => toggleChapter(idx)}
                        >
                            <span className="chapter-name">{chapter.name}</span>
                            <span className="toggle-icon">
                                {expandedChapter === idx ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                            </span>
                        </button>
                        
                        {expandedChapter === idx && (
                            <div className="chapter-content">
                                {chapter.sections?.map((section, sIdx) => (
                                    <div key={sIdx} className="section-group">
                                        <h4 className="section-name">{section.name}</h4>
                                        <div className="subsections-list">
                                            {section.subsections?.map((subsection, ssIdx) => (
                                                <button
                                                    key={ssIdx}
                                                    className={`subsection-item ${selectedSubsection?._id === subsection._id ? 'active' : ''}`}
                                                    onClick={() => handleSelectSubsection(subsection)}
                                                >
                                                    <span className="subsection-dot"></span>
                                                    {subsection.name}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                ))}
            </nav>
        </div>
    );

    const renderContent = () => {
        if (!selectedSubsection) {
            return (
                <div className="empty-state">
                    <BookOpen size={64} />
                    <h3>Select a topic to begin studying</h3>
                    <p>Choose from the chapters on the left to get started</p>
                </div>
            );
        }

        return (
            <div className="content-area">
                {isMobile && fullscreenMode && (
                    <div className="mobile-content-header">
                        <button 
                            className="back-btn"
                            onClick={handleBackToModules}
                        >
                            <ChevronUp size={24} />
                            Back
                        </button>
                        <h2>{selectedSubsection.name}</h2>
                    </div>
                )}

                {!isMobile && (
                    <div className="content-header">
                        <h2>{selectedSubsection.name}</h2>
                    </div>
                )}

                <div className="content-tabs">
                    <button 
                        className={`tab-btn ${!showQuiz ? 'active' : ''}`}
                        onClick={() => setShowQuiz(false)}
                    >
                        <BookOpen size={18} />
                        <span>Study Materials</span>
                    </button>
                    <button 
                        className={`tab-btn ${showQuiz ? 'active' : ''}`}
                        onClick={() => setShowQuiz(true)}
                    >
                        <span className="quiz-icon">📝</span>
                        <span>Quizzes</span>
                    </button>
                </div>

                {showQuiz ? (
                    <div className="quiz-section">
                        <GameSession subsectionId={selectedSubsection._id} />
                    </div>
                ) : (
                    <div className="materials-section">
                        <div className="ai-content">
                            <h3>📚 AI-Generated Content</h3>
                            <div className="content-block">
                                <p className="description-text">{selectedSubsection.content.description}</p>
                                
                                {selectedSubsection.content.key_points?.length > 0 && (
                                    <div className="key-points">
                                        <h4>🎯 Key Points</h4>
                                        <ul>
                                            {selectedSubsection.content.key_points.map((point, idx) => (
                                                <li key={idx}>{point}</li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                                
                                {selectedSubsection.content.examples?.length > 0 && (
                                    <div className="examples">
                                        <h4>💡 Examples</h4>
                                        <ul>
                                            {selectedSubsection.content.examples.map((example, idx) => (
                                                <li key={idx}>{example}</li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className={`module-view ${fullscreenMode && isMobile ? 'fullscreen-mobile' : ''}`}>
            {/* Sidebar */}
            {renderSidebar()}

            {/* Main Content */}
            <div className="module-main-content">
                {/* Top Bar */}
                <div className="module-top-bar">
                    <div className="top-bar-left">
                        {isMobile && !fullscreenMode && (
                            <button 
                                className="menu-btn"
                                onClick={() => setSidebarOpen(!sidebarOpen)}
                            >
                                <Menu size={24} />
                            </button>
                        )}
                    </div>

                    <div className="top-bar-right">
                        <button 
                            className={`action-btn chat-btn ${showChat ? 'active' : ''}`}
                            onClick={() => setShowChat(!showChat)}
                            title="Toggle Chat"
                        >
                            <MessageCircle size={20} />
                            <span className="action-label">{showChat ? 'Hide' : 'Chat'}</span>
                        </button>
                    </div>
                </div>

                {/* Content Wrapper */}
                <div className={`module-content-wrapper ${showChat ? 'with-chat' : ''}`}>
                    {renderContent()}
                    
                    {showChat && !fullscreenMode && (
                        <div className="module-chat-wrapper">
                            <div className="chat-header">
                                <h3>Module Chat</h3>
                                <button 
                                    className="close-chat-btn"
                                    onClick={() => setShowChat(false)}
                                >
                                    <X size={18} />
                                </button>
                            </div>
                            <BasicChat moduleId={module._id} type="module" />
                        </div>
                    )}
                </div>
            </div>

            {/* Mobile Chat Overlay */}
            {showChat && fullscreenMode && (
                <div className="mobile-chat-overlay">
                    <div className="mobile-chat-container">
                        <div className="chat-close-header">
                            <h3>Module Chat</h3>
                            <button 
                                className="close-chat-btn"
                                onClick={() => setShowChat(false)}
                            >
                                <X size={20} />
                            </button>
                        </div>
                        <BasicChat moduleId={module._id} type="module" />
                    </div>
                </div>
            )}

            {/* Sidebar Overlay for Mobile */}
            {isMobile && sidebarOpen && fullscreenMode && (
                <div 
                    className="sidebar-overlay"
                    onClick={() => setSidebarOpen(false)}
                ></div>
            )}
        </div>
    );
};

export default ModuleView;

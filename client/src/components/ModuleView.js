import React, { useState, useEffect } from 'react';
// ...existing code...
import YouTube from 'react-youtube';
import './ModuleView.css';
import GameSession from './GameSession';
import BasicChat from './BasicChat';
import { ChevronDown, ChevronUp, Menu, X, MessageCircle, BookOpen } from 'lucide-react';
import DynamicYoutubeVideos from './DynamicYoutubeVideos';

const ModuleView = ({ module }) => {
    const [selectedSubsection, setSelectedSubsection] = useState(null);
    const [showQuiz, setShowQuiz] = useState(false);
    const [selectedSectionName, setSelectedSectionName] = useState('');
    const [selectedChapterName, setSelectedChapterName] = useState('');
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

    // Close quiz UI when navigating away - BUT only if we're not actively in a quiz session
    useEffect(() => {
        const handleCloseQuiz = (e) => {
            // CRITICAL: Prevent closing quiz during active quiz sessions
            // Check multiple ways to ensure we're in an active quiz
            const quizCard = document.querySelector('.quiz-card-container');
            const flashcard = document.querySelector('.flashcard-container');
            const quizSection = document.querySelector('.quiz-section[data-quiz-active="true"]');
            const isGenerating = document.querySelector('.quiz-generating, .generating-spinner');
            const hasQuizContent = document.querySelector('.quiz-section') !== null;
            
            // If any quiz element exists OR quiz is shown, we're in an active session - DON'T CLOSE
            if (quizCard || flashcard || (quizSection && showQuiz) || (hasQuizContent && showQuiz) || isGenerating) {
                console.log('[ModuleView] Preventing quiz close - active session detected', {
                    quizCard: !!quizCard,
                    flashcard: !!flashcard,
                    quizSection: !!quizSection,
                    showQuiz,
                    hasQuizContent: !!hasQuizContent,
                    isGenerating: !!isGenerating
                });
                // Stop event propagation to prevent other handlers
                if (e && e.stopPropagation) {
                    e.stopPropagation();
                }
                // Prevent default behavior
                if (e && e.preventDefault) {
                    e.preventDefault();
                }
                return;
            }
            
            // Only close if we're truly not in a quiz
            console.log('[ModuleView] Closing quiz - no active session');
            setShowQuiz(false);
        };
        window.addEventListener('closeQuizUI', handleCloseQuiz);
        return () => window.removeEventListener('closeQuizUI', handleCloseQuiz);
    }, [showQuiz]); // Add showQuiz as dependency

    // Handle fullscreen mode for mobile
    useEffect(() => {
        if (selectedSubsection && isMobile) {
            setFullscreenMode(true);
        }
    }, [selectedSubsection, isMobile]);

    const toggleChapter = (idx) => {
        setExpandedChapter(expandedChapter === idx ? -1 : idx);
    };

    const handleSelectSubsection = (subsection, sectionName = '', chapterName = '') => {
        setSelectedSubsection(subsection);
        setSelectedSectionName(sectionName || '');
        setSelectedChapterName(chapterName || '');
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
                                                    onClick={() => handleSelectSubsection(subsection, section.name, chapter.name)}
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
                {/* Compact Header - Only on Mobile */}
                {isMobile && fullscreenMode && (
                    <div className="mobile-content-header">
                        <button 
                            className="back-btn"
                            onClick={handleBackToModules}
                        >
                            <ChevronUp size={20} />
                            <span>Back</span>
                        </button>
                        <h2>{selectedSubsection.name}</h2>
                    </div>
                )}

                {/* Compact Tabs - Always Visible */}
                <div className="content-tabs">
                    <button 
                        className={`tab-btn ${!showQuiz ? 'active' : ''}`}
                        onClick={() => {
                            // Prevent switching tabs during active quiz session
                            const quizCard = document.querySelector('.quiz-card-container');
                            const flashcard = document.querySelector('.flashcard-container');
                            const isGenerating = document.querySelector('.quiz-generating, .generating-spinner');
                            
                            if (quizCard || flashcard || isGenerating) {
                                console.log('[ModuleView] Preventing tab switch - active quiz session');
                                // Optionally show a message to user
                                return;
                            }
                            setShowQuiz(false);
                        }}
                    >
                        <BookOpen size={16} />
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

                {/* Content Section - Scrollable */}
                <div className="content-section-wrapper">
                    {showQuiz ? (
                        <div className="quiz-section" data-quiz-active="true">
                            <GameSession subsectionId={selectedSubsection._id} />
                        </div>
                    ) : (
                        <div className="materials-section">
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

                            <div className="video-section">
                                <h4>📺 Recommended Video</h4>
                                <DynamicYoutubeVideos
                                    subtopicName={selectedSubsection.name}
                                    description={selectedSubsection.content?.description}
                                    keyPoints={selectedSubsection.content?.key_points}
                                    examples={selectedSubsection.content?.examples}
                                />
                            </div>
                        </div>
                    )}
                </div>
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
                            onClick={() => {
                                setShowChat(!showChat);
                                // Hide sidebar when opening chat on mobile
                                if (!showChat && isMobile) {
                                    setSidebarOpen(false);
                                }
                            }}
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
                        <BasicChat 
                            moduleId={module._id} 
                            type="module" 
                            onClose={() => setShowChat(false)}
                        />
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
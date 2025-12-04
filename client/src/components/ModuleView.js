import React, { useState, useEffect } from 'react';
import './ModuleView.css';
import GameSession from './GameSession';
import BasicChat from './BasicChat';
import { ChevronDown, ChevronUp } from 'lucide-react';

const ModuleView = ({ module }) => {
    const [selectedSubsection, setSelectedSubsection] = useState(null);
    const [showQuiz, setShowQuiz] = useState(false);
    const [mobileNavOpen, setMobileNavOpen] = useState(false);
    const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
    
    useEffect(() => {
        const handleResize = () => {
            setIsMobile(window.innerWidth <= 768);
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

    const renderSidebar = () => (
        <div className="module-sidebar">
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
            
            {/* Mobile Dropdown Toggle */}
            {isMobile && (
                <button 
                    className="mobile-nav-toggle"
                    onClick={() => setMobileNavOpen(!mobileNavOpen)}
                >
                    <span>Navigation</span>
                    {mobileNavOpen ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                </button>
            )}
            
            <nav className={`module-nav ${isMobile && !mobileNavOpen ? 'mobile-hidden' : ''} ${isMobile && mobileNavOpen ? 'mobile-open' : ''}`}>
                {module.chapters?.map((chapter, idx) => (
                    <div key={idx} className="chapter-item">
                        <h3>{chapter.name}</h3>
                        {chapter.sections?.map((section, sIdx) => (
                            <div key={sIdx} className="section-item">
                                <h4>{section.name}</h4>
                                {section.subsections?.map((subsection, ssIdx) => (
                                    <div 
                                        key={ssIdx}
                                        className={`subsection-item ${selectedSubsection?._id === subsection._id ? 'active' : ''}`}
                                        onClick={() => {
                                            setSelectedSubsection(subsection);
                                            if (isMobile) setMobileNavOpen(false);
                                        }}
                                    >
                                        {subsection.name}
                                    </div>
                                ))}
                            </div>
                        ))}
                    </div>
                ))}
            </nav>
        </div>
    );

    const renderContent = () => {
        if (!selectedSubsection) {
            return (
                <div className="empty-state">
                    <h3>Select a topic to begin studying</h3>
                </div>
            );
        }

        return (
                <div className="content-area">
                <div className="content-header">
                    <h2>{selectedSubsection.name}</h2>
                    {/* Action buttons removed: Generate Quiz (AI/My Content) and Upload Material.
                        These features were moved/removed to keep ModuleView focused and
                        the Module page maintainable. */}
                </div>

                <div className="content-tabs">
                    <button 
                        className={!showQuiz ? 'active' : ''} 
                        onClick={() => setShowQuiz(false)}
                    >
                        Study Materials
                    </button>
                    <button 
                        className={showQuiz ? 'active' : ''} 
                        onClick={() => setShowQuiz(true)}
                    >
                        Quizzes & Flashcards
                    </button>
                </div>

                {showQuiz ? (
                    <div className="quiz-section">
                        {/* Gamified Quiz/Flashcard Session */}
                        <GameSession subsectionId={selectedSubsection._id} />
                    </div>
                ) : (
                    <div className="materials-section">
                        <div className="ai-content">
                            <h3>AI-Generated Content</h3>
                            <div className="content-block">
                                <p>{selectedSubsection.content.description}</p>
                                {selectedSubsection.content.key_points?.length > 0 && (
                                    <div className="key-points">
                                        <h4>Key Points</h4>
                                        <ul>
                                            {selectedSubsection.content.key_points.map((point, idx) => (
                                                <li key={idx}>{point}</li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                                {selectedSubsection.content.examples?.length > 0 && (
                                    <div className="examples">
                                        <h4>Examples</h4>
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



    const [showChat, setShowChat] = useState(false);

    return (
        <div className="module-view">
            {renderSidebar()}
            <div className="module-main-content">
                <div className="module-top-bar">
                    <button 
                        className={`chat-toggle ${showChat ? 'active' : ''}`}
                        onClick={() => setShowChat(!showChat)}
                    >
                        {showChat ? 'Hide Chat' : 'Show Chat'}
                    </button>
                </div>
                <div className={`module-content-wrapper ${showChat ? 'with-chat' : ''}`}>
                    {renderContent()}
                    {showChat && (
                        <div className="module-chat-wrapper">
                            <BasicChat moduleId={module._id} type="module" />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ModuleView;
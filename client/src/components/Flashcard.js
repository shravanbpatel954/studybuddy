import React, { useEffect, useState } from 'react';

const YOUTUBE_API_KEY = process.env.REACT_APP_YOUTUBE_API_KEY;

export default function Flashcard({ concept, onResponse }) {
  const [videoId, setVideoId] = useState(null);
  const [loadingVideo, setLoadingVideo] = useState(false);
  const [showVideo, setShowVideo] = useState(false);

  const fetchVideo = async () => {
    if (!concept || !YOUTUBE_API_KEY) return;
    setLoadingVideo(true);
    
    // Build a more specific search query from quiz question data
    // Priority: question text > explanation > front/title
    let searchTerms = [];
    
    // If this is a quiz question (has question property), use that
    if (concept.question) {
      // Extract key terms from the question
      const questionText = concept.question.toLowerCase();
      // Remove common question words
      const stopWords = ['which', 'what', 'how', 'when', 'where', 'why', 'is', 'are', 'the', 'a', 'an', 'method', 'tracks', 'detailed', 'user', 'interactions', 'on', 'a', 'webpage'];
      const words = questionText.split(/\s+/).filter(w => w.length > 3 && !stopWords.includes(w));
      searchTerms.push(...words.slice(0, 4)); // Take first 4 meaningful words
    }
    
    // Add explanation if available
    if (concept.explanation) {
      const explanationText = concept.explanation.toLowerCase();
      const words = explanationText.split(/\s+/).filter(w => w.length > 4).slice(0, 3);
      searchTerms.push(...words);
    }
    
    // Fallback to front/title
    if (searchTerms.length === 0) {
      const topic = concept.front || concept.title || '';
      if (topic) {
        const words = topic.toLowerCase().split(/\s+/).filter(w => w.length > 3).slice(0, 4);
        searchTerms.push(...words);
      }
    }
    
    if (searchTerms.length === 0) {
      setLoadingVideo(false);
      return;
    }
    
    try {
      // Create a focused search query with the key terms
      const uniqueTerms = [...new Set(searchTerms)];
      const cleanQuery = uniqueTerms.join(' ');
      const searchQuery = `${cleanQuery} tutorial explanation educational`;
      console.log('Searching YouTube for:', searchQuery);
      const maxResults = 5; // Get more results to find better matches
      const response = await fetch(
        `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(searchQuery)}&maxResults=${maxResults}&type=video&videoDuration=medium&order=relevance&key=${YOUTUBE_API_KEY}`
      );
      const data = await response.json();
      if (data.items && data.items.length > 0) {
        // Filter for educational content - prefer videos with educational keywords
        const educationalKeywords = ['tutorial', 'explain', 'learn', 'course', 'lesson', 'guide', 'introduction', 'basics', 'concept'];
        let video = null;
        
        // Score videos by relevance to the quiz question
        let bestVideo = null;
        let bestScore = 0;
        
        for (const item of data.items) {
          if (!item.id || !item.id.videoId) continue;
          const title = (item.snippet?.title || '').toLowerCase();
          const description = (item.snippet?.description || '').toLowerCase();
          let score = 0;
          
          // Check if video title/description contains search terms
          const searchText = `${title} ${description}`;
          for (const term of searchTerms) {
            if (searchText.includes(term.toLowerCase())) {
              score += 10; // Higher score for matching search terms
            }
          }
          
          // Bonus for educational keywords
          const hasEducationalContent = educationalKeywords.some(keyword => 
            title.includes(keyword) || description.includes(keyword)
          );
          if (hasEducationalContent) {
            score += 5;
          }
          
          // Penalty for irrelevant terms (performance, optimization when question is about tracking)
          const irrelevantTerms = ['performance', 'optimization', 'speed', 'fast', 'slow'];
          const hasIrrelevant = irrelevantTerms.some(term => 
            searchText.includes(term) && !searchTerms.some(st => st.includes(term))
          );
          if (hasIrrelevant && score < 15) {
            score -= 10; // Reduce score for irrelevant content
          }
          
          if (score > bestScore) {
            bestScore = score;
            bestVideo = item;
          }
        }
        
        // Use best matching video, or fallback to first if no good match
        if (bestVideo && bestScore >= 5) {
          video = bestVideo;
          console.log('Selected video with score:', bestScore, bestVideo.snippet?.title);
        } else if (data.items[0] && data.items[0].id && data.items[0].id.videoId) {
          video = data.items[0];
          console.log('Using fallback video:', video.snippet?.title);
        }
        
        if (video && video.id && video.id.videoId) {
          setVideoId(video.id.videoId);
        } else {
          setVideoId(null);
        }
      } else {
        setVideoId(null);
      }
    } catch (e) {
      console.error('Failed to fetch YouTube video:', e);
      setVideoId(null);
    } finally {
      setLoadingVideo(false);
    }
  };

  const handleShowVideo = () => {
    if (!showVideo && !videoId && !loadingVideo) {
      fetchVideo();
    }
    setShowVideo(true);
  };

  // Reset video state whenever the underlying concept changes
  useEffect(() => {
    setShowVideo(false);
    setVideoId(null);
    setLoadingVideo(false);
  }, [concept?.questionId, concept?.id, concept?.front, concept?.question]);

  if (!concept) return null;

  // Build front/back flashcard content
  const flashcardId =
    concept.questionId || concept.id || concept._id || concept.front || concept.question;

  const questionText =
    concept.front || concept.question || concept.title || 'Review this concept';

  const rawAnswer = (concept.correctAnswer || concept.back || '').toString().trim();

  const rawExplanation = (concept.explanation || '').replace(/\s+/g, ' ').trim();

  // Use the full explanation text (trimmed to a safe max length) so
  // flashcards feel closer to the detailed AI doubt-solver answers.
  const buildCoreExplanation = (text) => {
    if (!text) return '';
    const cleaned = text.replace(/\s+/g, ' ').trim();
    // Allow richer answers but keep them readable
    const limit = 600; // ~4–6 sentences
    return cleaned.length > limit ? `${cleaned.slice(0, limit)}…` : cleaned;
  };

  const coreExplanation = buildCoreExplanation(rawExplanation);

  let insightSource = concept.insight || concept.useCase || concept.topic || '';
  let insightText = insightSource ? insightSource.toString().trim() : '';
  if (insightText.length > 110) {
    insightText = `${insightText.slice(0, 110)}…`;
  }

  // Simple "Next" action – treat every reviewed card as completed.
  // We deliberately avoid "Got it / Review" style buttons so this
  // feels like a true flashcard, not a quiz grading step.
  const handleNext = () => {
    if (typeof onResponse === 'function') {
      // Most callers expect a boolean "gotIt" – we mark as true to
      // mean "card reviewed", not to score correctness.
      try {
        onResponse(true);
      } catch (e) {
        // Fallback for handlers that expect no arguments
        onResponse();
      }
    }
  };

  return (
    <>
      <style>{responsiveStyles}</style>
      <div style={styles.card} className="flashcard-container">
          <div style={styles.backContent}>
            <div style={styles.questionBlock}>
              <h3 style={styles.question} className="flashcard-question">
                {questionText}
              </h3>
            </div>

            {/* 1. DIRECT ANSWER */}
            {rawAnswer && (
              <div style={styles.sectionBlock}>
                <div style={styles.sectionLabel}>Answer</div>
                <p style={styles.answerText}>
                  <strong>{rawAnswer}</strong>
                </p>
              </div>
            )}

            {/* 2. CORE EXPLANATION */}
            {coreExplanation && (
              <div style={styles.sectionBlock}>
                <div style={styles.sectionLabel}>Core explanation</div>
                <p style={styles.text}>{coreExplanation}</p>
              </div>
            )}

            {/* 3. KEY INSIGHT / USE CASE */}
            {insightText && (
              <div style={styles.sectionBlock}>
                <div style={styles.sectionLabel}>Key insight</div>
                <p style={styles.text}>{insightText}</p>
              </div>
            )}

            {/* YOUTUBE VIDEO */}
            <div style={styles.videoSection}>
              {!showVideo ? (
                <button
                  onClick={handleShowVideo}
                  style={{
                    padding: '12px 20px',
                    background: 'linear-gradient(135deg, #00e0ff, #7f5eff)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '10px',
                    cursor: 'pointer',
                    fontWeight: '600',
                    fontSize: '14px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    marginTop: '12px'
                  }}
                >
                  📺 Show Recommended Video
                </button>
              ) : (
                <>
                  <h4 style={styles.sectionTitle} className="flashcard-section-title">
                    📺 Recommended Video
                  </h4>
                  {loadingVideo ? (
                    <p style={styles.loading}>Loading video...</p>
                  ) : videoId ? (
                    <div style={styles.videoWrapper} className="flashcard-video-wrapper">
                      <iframe
                        src={`https://www.youtube.com/embed/${videoId}`}
                        title="Recommended Video"
                        frameBorder="0"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                        style={styles.iframe}
                      ></iframe>
                    </div>
                  ) : (
                    <p style={styles.noVideo}>No video found for this topic.</p>
                  )}
                </>
              )}
            </div>

            {/* RESOURCES */}
            {concept.resources && (
              <div style={styles.resources}>
                {concept.resources.articles && (
                  <>
                    <h5 style={styles.subTitle}>📚 Related Articles</h5>
                    <ul>
                      {concept.resources.articles.map((item, i) => (
                        <li key={i}>{item}</li>
                      ))}
                    </ul>
                  </>
                )}

                {concept.resources.additionalTopics && (
                  <>
                    <h5 style={styles.subTitle}>🔍 Explore More Topics</h5>
                    <ul>
                      {concept.resources.additionalTopics.map((item, i) => (
                        <li key={i}>{item}</li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            )}

            {/* SINGLE NEXT BUTTON – true flashcard flow */}
            <div style={{ ...styles.actions, marginTop: 24 }} className="flashcard-actions">
              <button
                style={{ ...styles.btn, background: '#3b82f6' }}
                className="flashcard-btn"
                onClick={handleNext}
              >
                Next
              </button>
            </div>
          </div>
      </div>
    </>
  );
}

/* -------------------- STYLES -------------------- */

const styles = {
  card: {
    padding: '20px',
    background: '#0f172a',
    borderRadius: '16px',
    boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
    maxWidth: '850px',
    margin: '20px auto',
    color: '#e5e7eb',
    width: '100%',
    boxSizing: 'border-box',
    overflow: 'hidden'
  },
  frontContent: {
    minHeight: '180px',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between'
  },
  backContent: {
    minHeight: '220px',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px'
  },
  questionBlock: {
    textAlign: 'center',
    marginBottom: '20px'
  },
  question: {
    fontSize: '1.3rem',
    fontWeight: '700',
    marginBottom: '10px'
  },
  hintText: {
    fontSize: '0.9rem',
    color: '#9ca3af',
    marginTop: '8px'
  },
  answer: {
    fontSize: '1rem',
    color: '#9ca3af'
  },
  sectionBlock: {
    marginTop: '4px',
    padding: '10px 12px',
    background: 'rgba(15, 23, 42, 0.75)',
    borderRadius: '10px',
    border: '1px solid rgba(148, 163, 184, 0.4)'
  },
  sectionLabel: {
    fontSize: '0.78rem',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    color: '#9ca3af',
    marginBottom: '4px'
  },
  answerText: {
    fontSize: '1rem',
    color: '#e5e7eb'
  },
  explanation: {
    borderTop: '1px solid #1f2933',
    paddingTop: '16px',
    marginTop: '16px',
    clear: 'both',
    overflow: 'hidden'
  },
  sectionTitle: {
    fontSize: '1rem',
    color: '#60a5fa',
    marginBottom: '8px'
  },
  text: {
    fontSize: '0.95rem',
    color: '#d1d5db'
  },
  videoSection: {
    marginTop: '20px',
    borderTop: '1px solid #1f2933',
    paddingTop: '16px',
    clear: 'both',
    overflow: 'hidden'
  },
  loading: {
    color: '#93c5fd'
  },
  noVideo: {
    color: '#9ca3af'
  },
  videoWrapper: {
    position: 'relative',
    paddingBottom: '56.25%',
    height: 0,
    overflow: 'hidden',
    borderRadius: '12px',
    marginTop: '12px',
    width: '100%',
    maxWidth: '100%'
  },
  iframe: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%'
  },
  resources: {
    marginTop: '20px',
    borderTop: '1px solid #1f2933',
    paddingTop: '16px',
    fontSize: '0.9rem',
    color: '#cbd5f5'
  },
  subTitle: {
    marginTop: '10px',
    marginBottom: '6px',
    color: '#93c5fd'
  },
  actions: {
    display: 'flex',
    gap: '10px',
    justifyContent: 'center',
    marginTop: '20px',
    flexWrap: 'wrap'
  },
  btn: {
    padding: '10px 24px',
    borderRadius: '8px',
    border: 'none',
    fontWeight: '600',
    color: '#fff',
    cursor: 'pointer',
    minWidth: '120px'
  }
};

// Add responsive styles via style tag
const responsiveStyles = `
  @media (max-width: 768px) {
    .flashcard-container {
      padding: 16px !important;
      margin: 16px !important;
      border-radius: 12px !important;
    }
    .flashcard-question {
      font-size: 1.1rem !important;
    }
    .flashcard-video-wrapper {
      margin-top: 12px !important;
    }
    .flashcard-actions {
      flex-direction: column;
      gap: 8px !important;
    }
    .flashcard-btn {
      width: 100% !important;
      min-width: unset !important;
    }
    .option-item {
      padding: 10px 12px !important;
      font-size: 14px !important;
    }
    .summary-row {
      flex-direction: column !important;
      align-items: flex-start !important;
      gap: 4px !important;
    }
  }
  @media (max-width: 480px) {
    .flashcard-container {
      padding: 12px !important;
      margin: 10px !important;
    }
    .flashcard-question {
      font-size: 1rem !important;
    }
    .flashcard-section-title {
      font-size: 0.9rem !important;
    }
    .option-item {
      padding: 8px 10px !important;
      font-size: 13px !important;
    }
    .option-badge {
      font-size: 11px !important;
      padding: 3px 8px !important;
    }
  }
`;

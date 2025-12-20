// client/src/components/DynamicYoutubeVideos.js
// Component for displaying recommended YouTube videos with smart relevance scoring

import React, { useState, useEffect } from 'react';
import YouTube from 'react-youtube';
import { Maximize2, ExternalLink, X } from 'lucide-react';
import { useRecommendedVideo } from '../hooks/useRecommendedVideo';
import './DynamicYoutubeVideos.css';

const DynamicYoutubeVideos = ({
  subtopicName,
  sectionName = '',
  chapterName = '',
  subjectName = '',
  description = '',
  keyPoints = [],
  examples = []
}) => {
  const [showModal, setShowModal] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [manualLoad, setManualLoad] = useState(false);

  // Use the smart video recommendation hook
  const { loading, error, mode, video } = useRecommendedVideo(
    manualLoad ? subtopicName : null, // Only fetch when manually triggered
    description || '',
    Array.isArray(keyPoints) ? keyPoints : [],
    Array.isArray(examples) ? examples : []
  );

  const youtubeOptions = {
    height: '315',
    width: '100%',
    playerVars: {
      autoplay: 0,
      controls: 1,
      rel: 0,
      modestbranding: 1,
    },
  };

  const openInYouTube = (videoId) => {
    window.open(`https://www.youtube.com/watch?v=${videoId}`, '_blank');
  };

  const handleLoadVideos = () => {
    setManualLoad(true);
  };

  // Clear state when topic changes
  useEffect(() => {
    setManualLoad(false);
    setSelectedVideo(null);
    setShowModal(false);
  }, [subtopicName, sectionName, chapterName, subjectName]);

  // Update selected video when a new video is loaded
  useEffect(() => {
    if (video && mode === 'VIDEO') {
      setSelectedVideo(video);
    }
  }, [video, mode]);

  const openModal = (videoToShow) => {
    setSelectedVideo(videoToShow || video);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
  };

  if (!subtopicName) {
    return <div className="video-empty">Topic not provided.</div>;
  }

  // Generate a simple explanation fallback from the content
  const generateFallbackExplanation = () => {
    const parts = [];
    
    if (description) {
      parts.push(`<p><strong>Overview:</strong> ${description}</p>`);
    }

    if (Array.isArray(keyPoints) && keyPoints.length > 0) {
      parts.push('<p><strong>Key Points:</strong></p><ul>');
      keyPoints.forEach(point => {
        parts.push(`<li>${point}</li>`);
      });
      parts.push('</ul>');
    }

    if (Array.isArray(examples) && examples.length > 0) {
      parts.push('<p><strong>Examples:</strong></p><ul>');
      examples.forEach(example => {
        parts.push(`<li>${example}</li>`);
      });
      parts.push('</ul>');
    }

    return parts.join('');
  };

  return (
    <>
      <div className="youtube-videos-container">
        <div className="youtube-actions-row">
          <button 
            className="primary-btn" 
            onClick={handleLoadVideos} 
            disabled={loading || (manualLoad && mode !== null)}
          >
            {loading ? 'Loading best video...' : manualLoad && mode ? 'Video Loaded' : 'Load relevant videos'}
          </button>
          {error && <span className="error-text">{error}</span>}
        </div>

        {!manualLoad && (
          <p className="note">Click the button to fetch the best relevant YouTube video for this topic.</p>
        )}

        {loading && (
          <div className="video-loading">
            <p>Searching for the best relevant video...</p>
          </div>
        )}

        {/* Show high-quality video when found */}
        {manualLoad && mode === 'VIDEO' && video && (
          <div className="youtube-videos">
            <div className="youtube-video-wrapper">
              <div className="video-preview">
                <YouTube
                  videoId={video.videoId}
                  opts={youtubeOptions}
                  className="youtube-embed"
                />
              </div>
              <div className="video-actions">
                <button 
                  className="video-action-btn expand-btn"
                  onClick={() => openModal(video)}
                  title="View in fullscreen"
                >
                  <Maximize2 size={16} />
                  <span>View Fullscreen</span>
                </button>
                <button 
                  className="video-action-btn external-btn"
                  onClick={() => openInYouTube(video.videoId)}
                  title="Open in YouTube"
                >
                  <ExternalLink size={16} />
                  <span>Open in YouTube</span>
                </button>
              </div>
              <div className="video-info">
                <h5 className="video-title">{video.title}</h5>
                {video.channelTitle && (
                  <p className="video-channel">{video.channelTitle}</p>
                )}
                {video.description && (
                  <p className="youtube-description">
                    {video.description.substring(0, 200)}...
                  </p>
                )}
                {video.score && (
                  <p className="video-score">Relevance Score: {video.score.toFixed(1)}</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Simple fallback when no video is available */}
        {manualLoad && mode === 'AI_FALLBACK' && (
          <div className="video-fallback">
            <p className="fallback-subtitle">
              No suitable YouTube video found for this topic right now.
            </p>
          </div>
        )}
      </div>

      {/* Fullscreen Modal */}
      {showModal && selectedVideo && (
        <div className="video-modal-overlay" onClick={closeModal}>
          <div className="video-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="video-modal-header">
              <h3>{selectedVideo.title}</h3>
              <button className="video-modal-close" onClick={closeModal}>
                <X size={20} />
              </button>
            </div>
            <div className="video-modal-player">
              <YouTube
                videoId={selectedVideo.videoId}
                opts={{
                  height: '100%',
                  width: '100%',
                  playerVars: {
                    autoplay: 0,
                    controls: 1,
                    rel: 0,
                    modestbranding: 1,
                  },
                }}
                className="youtube-embed-modal"
              />
            </div>
            <div className="video-modal-footer">
              <button 
                className="video-action-btn external-btn"
                onClick={() => openInYouTube(selectedVideo.videoId)}
              >
                <ExternalLink size={16} />
                <span>Open in YouTube</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default DynamicYoutubeVideos;

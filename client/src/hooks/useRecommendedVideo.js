// client/src/hooks/useRecommendedVideo.js
// Hook to fetch the recommended video for a given topic title.

import { useEffect, useState } from 'react';

// Use the same frontend YouTube key as flashcards so behaviour matches
const YOUTUBE_API_KEY = process.env.REACT_APP_YOUTUBE_API_KEY;

/**
 * Custom hook to fetch recommended YouTube video for a topic
 * @param {string} topicTitle - The topic/subsection title
 * @param {string} description - Optional description text
 * @param {Array<string>} keyPoints - Optional array of key points
 * @param {Array<string>} examples - Optional array of examples
 * @returns {Object} { loading, error, mode, video }
 */
export function useRecommendedVideo(topicTitle, description = '', keyPoints = [], examples = []) {
  const [state, setState] = useState({
    loading: false,
    error: null,
    mode: null,      // 'VIDEO' | 'AI_FALLBACK' | null
    video: null,     // { videoId, title, description, channelTitle, thumbnail, score } | null
  });

  useEffect(() => {
    if (!topicTitle || !topicTitle.trim()) {
      setState({
        loading: false,
        error: null,
        mode: null,
        video: null,
      });
      return;
    }

    if (!YOUTUBE_API_KEY) {
      setState({
        loading: false,
        error: 'YouTube API key not configured',
        mode: null,
        video: null,
      });
      return;
    }

    let cancelled = false;

    const buildSearchQuery = () => {
      const parts = [];

      // Core topic first
      parts.push(topicTitle.trim());

      // Add a short description snippet
      if (description) {
        const firstSentence = description.split(/(?<=[.!?])\s+/)[0];
        parts.push(firstSentence);
      }

      // Add a couple of key points / examples for more context
      if (Array.isArray(keyPoints) && keyPoints.length > 0) {
        parts.push(...keyPoints.slice(0, 2));
      }
      if (Array.isArray(examples) && examples.length > 0) {
        parts.push(examples[0]);
      }

      const base = parts.join(' ');
      // Keep query reasonably short
      const trimmed = base.length > 220 ? base.slice(0, 220) : base;
      return `${trimmed} tutorial explanation beginner`;
    };

    async function fetchVideo() {
      setState((prev) => ({ ...prev, loading: true, error: null }));

      try {
        const searchQuery = buildSearchQuery();

        const maxResults = 5;
        const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(
          searchQuery
        )}&maxResults=${maxResults}&type=video&videoDuration=medium&order=relevance&key=${YOUTUBE_API_KEY}`;

        const res = await fetch(url);
        if (!res.ok) {
          throw new Error(`YouTube search failed: ${res.status}`);
        }
        const data = await res.json();

        if (cancelled) return;

        const items = data.items || [];
        if (!items.length) {
          setState({
            loading: false,
            error: null,
            mode: 'AI_FALLBACK',
            video: null,
          });
          return;
        }

        // Prefer videos with educational keywords in title
        const educationalKeywords = ['tutorial', 'guide', 'introduction', 'intro', 'lesson', 'course', 'explained', 'basics'];
        const scored = items
          .filter((item) => item.id && item.id.videoId)
          .map((item) => {
            const title = (item.snippet?.title || '').toLowerCase();
            let score = 0;
            educationalKeywords.forEach((kw) => {
              if (title.includes(kw)) score += 1;
            });
            return { item, score };
          });

        scored.sort((a, b) => b.score - a.score);
        const best = (scored[0] || {}).item || items[0];

        const videoId = best.id?.videoId;
        if (!videoId) {
          setState({
            loading: false,
            error: null,
            mode: 'AI_FALLBACK',
            video: null,
          });
          return;
        }

        setState({
          loading: false,
          error: null,
          mode: 'VIDEO',
          video: {
            videoId,
            title: best.snippet?.title || topicTitle,
            description: best.snippet?.description || '',
            channelTitle: best.snippet?.channelTitle || '',
            thumbnail: best.snippet?.thumbnails?.high?.url || best.snippet?.thumbnails?.default?.url,
            score: scored[0]?.score ?? 0,
          },
        });
      } catch (err) {
        if (cancelled) return;
        console.error('Error fetching recommended video', err);
        setState({
          loading: false,
          error: err.response?.data?.error || err.message || 'Failed to load recommended video',
          mode: 'AI_FALLBACK',
          video: null,
        });
      }
    }

    fetchVideo();

    return () => {
      cancelled = true;
    };
  }, [topicTitle, description, JSON.stringify(keyPoints), JSON.stringify(examples)]);

  return state;
}


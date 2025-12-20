// backend00/src/utils/videoRecommendation.js
// Utility functions to fetch and score YouTube videos for a given topic.

const axios = require('axios');
require('dotenv').config();

// Prefer the same key used on the frontend (REACT_APP_YOUTUBE_API_KEY)
// so behaviour matches flashcards. If you also provide YOUTUBE_API_KEY,
// it will be used as a fallback when the primary key hits quota / 403.
const YOUTUBE_API_KEYS = [
  process.env.REACT_APP_YOUTUBE_API_KEY,
  process.env.YOUTUBE_API_KEY
].filter(Boolean);
const YOUTUBE_SEARCH_URL = 'https://www.googleapis.com/youtube/v3/search';
const YOUTUBE_VIDEOS_URL = 'https://www.googleapis.com/youtube/v3/videos';

/**
 * Normalize a topic string:
 * - lowercase
 * - remove special characters
 * - remove common stop words
 */
function normalizeTopic(topic) {
  if (!topic) return '';
  return topic
    .toLowerCase()
    .replace(/[^a-z0-9 ]/gi, ' ')
    .replace(/\b(and|or|the|of|for|to|in|its|is|a|an|with|by|from|as|on|at|this|that|these|those|what|how|why|when|where)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extract key terms from topic, description, key points, and examples
 * Returns an array of meaningful terms
 */
function extractKeyTerms(topic, description = '', keyPoints = [], examples = []) {
  const allText = [
    topic,
    description,
    ...(Array.isArray(keyPoints) ? keyPoints : []),
    ...(Array.isArray(examples) ? examples : [])
  ].join(' ');

  // Extract words that are 4+ characters and not common stop words
  const stopWords = new Set([
    'this', 'that', 'these', 'those', 'with', 'from', 'have', 'has', 'had',
    'will', 'would', 'should', 'could', 'might', 'must', 'can', 'may',
    'about', 'above', 'after', 'again', 'against', 'all', 'also', 'am',
    'an', 'and', 'any', 'are', 'as', 'at', 'be', 'because', 'been', 'before',
    'being', 'below', 'between', 'both', 'but', 'by', 'can', 'did', 'do',
    'does', 'doing', 'during', 'each', 'few', 'for', 'from', 'further',
    'had', 'has', 'have', 'having', 'he', 'her', 'here', 'hers', 'herself',
    'him', 'himself', 'his', 'how', 'i', 'if', 'in', 'into', 'is', 'it',
    'its', 'itself', 'just', 'me', 'more', 'most', 'my', 'myself', 'no',
    'nor', 'not', 'now', 'of', 'off', 'on', 'once', 'only', 'or', 'other',
    'our', 'ours', 'ourselves', 'out', 'over', 'own', 'same', 'she', 'should',
    'so', 'some', 'such', 'than', 'that', 'the', 'their', 'theirs', 'them',
    'themselves', 'then', 'there', 'these', 'they', 'this', 'those', 'through',
    'to', 'too', 'under', 'until', 'very', 'was', 'we', 'were', 'what',
    'when', 'where', 'which', 'while', 'who', 'whom', 'why', 'will', 'with'
  ]);

  const words = allText
    .toLowerCase()
    .replace(/[^a-z0-9 ]/gi, ' ')
    .split(/\s+/)
    .filter(w => w.length >= 4 && !stopWords.has(w));

  // Return unique words, prioritizing longer ones
  return [...new Set(words)].sort((a, b) => b.length - a.length).slice(0, 10);
}

/**
 * Build multiple search queries for the given topic.
 * This increases the chance of getting high-quality, relevant videos.
 */
function buildSearchQueries(topic, description = '', keyPoints = [], examples = []) {
  const clean = normalizeTopic(topic);
  const keyTerms = extractKeyTerms(topic, description, keyPoints, examples);
  const termString = keyTerms.slice(0, 5).join(' ');

  const queries = [];

  // Primary queries with topic focus
  if (clean) {
    queries.push(`${clean} tutorial`);
    queries.push(`${clean} explained`);
    queries.push(`what is ${clean}`);
    queries.push(`${clean} for beginners`);
  }

  // Queries with key terms
  if (termString) {
    queries.push(`${termString} tutorial`);
    queries.push(`${termString} explained`);
  }

  // Fallback: just the topic
  if (clean) {
    queries.push(clean);
  }

  return queries.slice(0, 5); // Limit to 5 queries
}

/**
 * Raw YouTube search request.
 * Returns a simplified list of video objects with statistics.
 */
async function searchYouTube(query, maxResults = 5) {
  if (!YOUTUBE_API_KEYS.length) {
    throw new Error('REACT_APP_YOUTUBE_API_KEY or YOUTUBE_API_KEY must be set in environment variables');
  }

  let lastError = null;

  // Try all configured keys one by one until one succeeds.
  for (let i = 0; i < YOUTUBE_API_KEYS.length; i++) {
    const apiKey = YOUTUBE_API_KEYS[i];

    try {
      const searchResponse = await axios.get(YOUTUBE_SEARCH_URL, {
        params: {
          key: apiKey,
          q: query,
          part: 'snippet',
          type: 'video',
          maxResults: Math.min(maxResults, 10),
          order: 'relevance',
          videoDuration: 'medium', // Prefer medium-length videos (4-20 minutes)
          videoDefinition: 'high',
          safeSearch: 'strict',
          relevanceLanguage: 'en'
        },
      });

      if (!searchResponse.data.items || searchResponse.data.items.length === 0) {
        return [];
      }

      // Get video statistics for quality scoring (best-effort)
      const videoIds = searchResponse.data.items.map(item => item.id.videoId).join(',');
      let statsResponse = { data: { items: [] } };

      try {
        statsResponse = await axios.get(YOUTUBE_VIDEOS_URL, {
          params: {
            part: 'statistics,contentDetails',
            id: videoIds,
            key: apiKey
          }
        });
      } catch (statsError) {
        console.warn('Failed to fetch video statistics:', statsError.message);
      }

      return searchResponse.data.items.map((item) => {
        const stats = statsResponse.data.items?.find(stat => stat.id === item.id.videoId)?.statistics || {};
        const contentDetails = statsResponse.data.items?.find(stat => stat.id === item.id.videoId)?.contentDetails || {};

        return {
          videoId: item.id.videoId,
          title: item.snippet.title,
          description: item.snippet.description,
          channelTitle: item.snippet.channelTitle,
          thumbnail: item.snippet.thumbnails?.high?.url || item.snippet.thumbnails?.default?.url,
          publishedAt: item.snippet.publishedAt,
          viewCount: parseInt(stats.viewCount) || 0,
          likeCount: parseInt(stats.likeCount) || 0,
          commentCount: parseInt(stats.commentCount) || 0,
          duration: contentDetails.duration || 'PT0S'
        };
      });
    } catch (error) {
      lastError = error;
      console.error(
        `YouTube search error for query "${query}" with key #${i + 1}:`,
        error.message
      );
      // On 403 / quota errors, move on to the next key (if any)
      const status = error.response?.status;
      if (status === 403 || status === 400) {
        continue;
      }
      // For other errors (network, etc.), also try the next key
    }
  }

  if (lastError) {
    console.error(`All configured YouTube API keys failed for query "${query}":`, lastError.message);
  }
  return [];
}

/**
 * Score a given video for a given topic.
 * Higher score => more relevant.
 */
function scoreVideo(video, topic, description = '', keyPoints = [], examples = []) {
  const title = (video.title || '').toLowerCase();
  const desc = (video.description || '').toLowerCase();
  const channel = (video.channelTitle || '').toLowerCase();
  const normalizedTopic = normalizeTopic(topic);
  const keyTerms = extractKeyTerms(topic, description, keyPoints, examples);

  let score = 0;

  // Strong relevance: topic words in title (highest weight)
  const topicWords = normalizedTopic.split(' ').filter(w => w.length >= 4);
  topicWords.forEach(word => {
    if (title.includes(word)) score += 5;
    if (desc.includes(word)) score += 2;
  });

  // Key terms matching
  keyTerms.forEach(term => {
    if (title.includes(term)) score += 3;
    if (desc.includes(term)) score += 1;
  });

  // Helpful educational keywords
  const educationalKeywords = ['tutorial', 'explained', 'introduction', 'intro', 'guide', 'course', 'lesson', 'learn', 'basics', 'fundamentals'];
  educationalKeywords.forEach(keyword => {
    if (title.includes(keyword)) score += 2;
  });

  // Quality indicators
  if (video.viewCount >= 10000) score += 1;
  if (video.viewCount >= 100000) score += 1;
  if (video.likeCount >= 100) score += 1;

  // Penalize low-quality indicators
  if (title.includes('clickbait') || title.includes('shocking')) score -= 5;
  if (title.match(/\d+\s*(million|billion|trillion)/)) score -= 2; // Avoid clickbait numbers

  // Boost for trusted educational channels
  const trustedChannels = [
    'simplilearn', 'google analytics', 'analytics mania', 'coursera', 'udemy',
    'edx', 'khan academy', 'freecodecamp', 'codecademy', 'pluralsight',
    'lynda', 'linkedin learning', 'skillshare', 'udacity', 'coursera'
  ];
  if (trustedChannels.some(name => channel.includes(name.toLowerCase()))) {
    score += 3;
  }

  // Penalize very short or very long videos (prefer 5-30 minutes)
  const durationMatch = video.duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (durationMatch) {
    const hours = parseInt(durationMatch[1] || 0);
    const minutes = parseInt(durationMatch[2] || 0);
    const totalMinutes = hours * 60 + minutes;
    
    if (totalMinutes >= 5 && totalMinutes <= 30) {
      score += 2; // Prefer medium-length educational videos
    } else if (totalMinutes < 2) {
      score -= 2; // Penalize very short videos
    } else if (totalMinutes > 60) {
      score -= 1; // Slight penalty for very long videos
    }
  }

  return Math.max(0, score); // Ensure non-negative
}

/**
 * Main function: get the best video for a topic.
 * Returns either:
 * - { mode: 'VIDEO', video: {...} }
 * - { mode: 'AI_FALLBACK' }
 */
async function getBestVideoForTopic(topic, description = '', keyPoints = [], examples = []) {
  if (!topic || !topic.trim()) {
    throw new Error('Topic is required for video recommendation');
  }

  const queries = buildSearchQueries(topic, description, keyPoints, examples);
  
  // Search with all queries in parallel
  const allResults = await Promise.all(
    queries.map((q) => searchYouTube(q, 5).catch(() => [])) // in case one call fails
  );

  const allVideos = allResults.flat();

  if (allVideos.length === 0) {
    return { mode: 'AI_FALLBACK' };
  }

  // Attach scores and remove duplicates
  const scoredVideos = allVideos.map((v) => ({
    ...v,
    score: scoreVideo(v, topic, description, keyPoints, examples),
  }));

  // Remove duplicates by videoId (keep highest score)
  const uniqueVideos = new Map();
  scoredVideos.forEach(vid => {
    const existing = uniqueVideos.get(vid.videoId);
    if (!existing || vid.score > existing.score) {
      uniqueVideos.set(vid.videoId, vid);
    }
  });

  const rankedArr = Array.from(uniqueVideos.values())
    .sort((a, b) => b.score - a.score);

  // DEBUG: Uncomment during development to see scoring
  // console.table(rankedArr.slice(0, 5).map(v => ({ 
  //   title: v.title.substring(0, 50), 
  //   score: v.score,
  //   views: v.viewCount 
  // })));

  const bestVideo = rankedArr[0];

  // If we have at least one result, always return the top-ranked video.
  // We previously used a strict MIN_SCORE threshold which caused
  // many valid topics (like SEO, hashing, analytics) to fall back
  // to AI text even when good videos existed. The app UX is better
  // if we always show *something* when YouTube returns results.
  if (!bestVideo) {
    return { mode: 'AI_FALLBACK' };
  }

  return {
    mode: 'VIDEO',
    video: {
      videoId: bestVideo.videoId,
      title: bestVideo.title,
      description: bestVideo.description,
      channelTitle: bestVideo.channelTitle,
      thumbnail: bestVideo.thumbnail,
      score: bestVideo.score,
      viewCount: bestVideo.viewCount,
      likeCount: bestVideo.likeCount
    },
  };
}

module.exports = {
  getBestVideoForTopic,
  normalizeTopic,
  buildSearchQueries,
  scoreVideo
};


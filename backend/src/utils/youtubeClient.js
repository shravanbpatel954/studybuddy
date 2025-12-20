const axios = require('axios');
require('dotenv').config();

class YouTubeClient {
    constructor() {
        this.apiKey = process.env.YOUTUBE_API_KEY;
        this.baseURL = 'https://www.googleapis.com/youtube/v3';
        this.cache = new Map();
        this.cacheDuration = 30 * 60 * 1000; // 30 minutes
    }

    async searchVideos(topic, maxResults = 8) {
        if (!this.apiKey) {
            throw new Error('YOUTUBE_API_KEY is not set');
        }

        const cacheKey = `videos_${topic}`;
        const cached = this.cache.get(cacheKey);
        if (cached && (Date.now() - cached.timestamp < this.cacheDuration)) {
            return cached.data;
        }

        // Search for regular YouTube videos
        const searchResponse = await axios.get(`${this.baseURL}/search`, {
            params: {
                part: 'snippet',
                q: `"${topic}" tutorial OR introduction OR basics OR course OR lesson`,
                maxResults: maxResults * 2,
                type: 'video',
                videoDuration: 'any',
                videoDefinition: 'high',
                key: this.apiKey,
                order: 'relevance',
                regionCode: 'US',
                relevanceLanguage: 'en',
                safeSearch: 'strict'
            }
        });

        const videoIds = searchResponse.data.items.map(item => item.id.videoId).join(',');
        const statsResponse = await axios.get(`${this.baseURL}/videos`, {
            params: {
                part: 'statistics,contentDetails',
                id: videoIds,
                key: this.apiKey
            }
        });

        const videos = searchResponse.data.items.map(item => {
            const stats = statsResponse.data.items.find(stat => stat.id === item.id.videoId)?.statistics || {};
            return {
                videoId: item.id.videoId,
                title: item.snippet.title,
                description: item.snippet.description,
                thumbnails: item.snippet.thumbnails,
                publishedAt: item.snippet.publishedAt,
                channelTitle: item.snippet.channelTitle,
                embedUrl: `https://www.youtube.com/embed/${item.id.videoId}`,
                viewCount: parseInt(stats.viewCount) || 0,
                likeCount: parseInt(stats.likeCount) || 0,
                commentCount: parseInt(stats.commentCount) || 0
            };
        });

        // Simple quality filter: drop very low engagement videos
        const filtered = videos.filter(v => (v.viewCount >= 500 || v.likeCount >= 25));

        this.cache.set(cacheKey, {
            timestamp: Date.now(),
            data: filtered
        });

        return filtered;
    }
    isoDurationToSeconds(iso = 'PT0S') {
        // Simple ISO 8601 duration parser for PT#H#M#S
        const match = /PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/.exec(iso);
        if (!match) return 0;
        const hours = parseInt(match[1] || '0', 10);
        const mins = parseInt(match[2] || '0', 10);
        const secs = parseInt(match[3] || '0', 10);
        return hours * 3600 + mins * 60 + secs;
    }

    async searchVideos(topic, maxResults = 8) {
        if (!this.apiKey) {
            throw new Error('YOUTUBE_API_KEY is not set');
        }

        const cacheKey = `videos_${topic}`;
        const cached = this.cache.get(cacheKey);
        if (cached && (Date.now() - cached.timestamp < this.cacheDuration)) {
            return cached.data;
        }

        try {
            // Search for regular YouTube videos
            const searchResponse = await axios.get(`${this.baseURL}/search`, {
                params: {
                    part: 'snippet',
                    // Weighted for educational intent; include topic as phrase
                    q: `"${topic}" tutorial OR introduction OR basics OR course OR lesson`,
                    maxResults: maxResults * 2,
                    type: 'video',
                    videoDuration: 'any',
                    videoDefinition: 'high',
                    key: this.apiKey,
                    order: 'relevance',
                    regionCode: 'US',
                    relevanceLanguage: 'en',
                    safeSearch: 'strict'
                }
            });

            const videoIds = searchResponse.data.items.map(item => item.id.videoId).join(',');
            const statsResponse = await axios.get(`${this.baseURL}/videos`, {
                params: {
                    part: 'statistics,contentDetails',
                    id: videoIds,
                    key: this.apiKey
                }
            });

            const videos = searchResponse.data.items.map(item => {
                const matchStats = statsResponse.data.items.find(stat => stat.id === item.id.videoId);
                const stats = matchStats?.statistics || {};
                const durationIso = matchStats?.contentDetails?.duration || 'PT0S';
                const durationSec = this.isoDurationToSeconds(durationIso);
                return {
                    videoId: item.id.videoId,
                    title: item.snippet.title,
                    description: item.snippet.description,
                    thumbnails: item.snippet.thumbnails,
                    publishedAt: item.snippet.publishedAt,
                    channelTitle: item.snippet.channelTitle,
                    embedUrl: `https://www.youtube.com/embed/${item.id.videoId}`,
                    viewCount: parseInt(stats.viewCount) || 0,
                    likeCount: parseInt(stats.likeCount) || 0,
                    commentCount: parseInt(stats.commentCount) || 0,
                    durationSec
                };
            });

            // Prefer educational / explanatory content
            const educationalKeywords = ['tutorial', 'lesson', 'course', 'guide', 'explained', 'introduction', 'basics', 'example', 'study'];

            const matchesEducation = (video) => {
                const haystack = `${video.title} ${video.description}`.toLowerCase();
                return educationalKeywords.some(k => haystack.includes(k));
            };

            const minViews = 100;
            const minLikes = 10;

            let filteredVideos = videos
                .filter(v => (v.viewCount >= minViews || v.likeCount >= minLikes) && matchesEducation(v));

            // Fallbacks if filtering is too strict
            if (filteredVideos.length === 0) {
                filteredVideos = videos.filter(v => v.viewCount >= minViews || v.likeCount >= minLikes);
            }
            if (filteredVideos.length === 0) {
                filteredVideos = videos;
            }

            const getScore = (v) => {
                const viewScore = Math.log10(v.viewCount + 1) * 2;
                const likeScore = Math.log10(v.likeCount + 1) * 3;
                const commentScore = Math.log10(v.commentCount + 1) * 1.5;
                const educationBonus = matchesEducation(v) ? 3 : 0;
                return viewScore + likeScore + commentScore + educationBonus;
            };

            const sortedVideos = filteredVideos
                .sort((a, b) => getScore(b) - getScore(a))
                .slice(0, maxResults);

            this.cache.set(cacheKey, {
                timestamp: Date.now(),
                data: sortedVideos
            });
            return sortedVideos;
        } catch (error) {
            console.error('YouTube API error:', error);
            throw error;
        }
    }

    async searchShorts(topic, maxResults = 8) {
        const cacheKey = `shorts_${topic}`;
        const cached = this.cache.get(cacheKey);
        if (cached && (Date.now() - cached.timestamp < this.cacheDuration)) {
            return cached.data;
        }

        try {
            // First search for relevant shorts
            const searchResponse = await axios.get(`${this.baseURL}/search`, {
                params: {
                    part: 'snippet',
                    q: `${topic} shorts explain tutorial tips tricks`,
                    maxResults: maxResults * 2, // Get more results to filter
                    type: 'video',
                    videoDuration: 'short',
                    videoDefinition: 'high',
                    key: this.apiKey,
                    order: 'rating', // Get highly-rated videos
                    regionCode: 'US',
                    relevanceLanguage: 'en',
                    safeSearch: 'moderate'
                }
            });

            // Get video statistics to filter by engagement
            const videoIds = searchResponse.data.items.map(item => item.id.videoId).join(',');
            const statsResponse = await axios.get(`${this.baseURL}/videos`, {
                params: {
                    part: 'statistics,contentDetails',
                    id: videoIds,
                    key: this.apiKey
                }
            });

            // Combine search results with statistics
            const videos = searchResponse.data.items.map(item => {
                const stats = statsResponse.data.items.find(stat => stat.id === item.id.videoId)?.statistics || {};
                return {
                    videoId: item.id.videoId,
                    title: item.snippet.title,
                    description: item.snippet.description,
                    thumbnails: item.snippet.thumbnails,
                    publishedAt: item.snippet.publishedAt,
                    channelTitle: item.snippet.channelTitle,
                    embedUrl: `https://www.youtube.com/embed/${item.id.videoId}`,
                    viewCount: parseInt(stats.viewCount) || 0,
                    likeCount: parseInt(stats.likeCount) || 0,
                    commentCount: parseInt(stats.commentCount) || 0
                };
            });

            // Sort by engagement score and filter top results
                // Relaxed filter: lower thresholds
                const minViews = 100;
                const minLikes = 10;
                let filteredVideos = videos.filter(video => video.viewCount >= minViews || video.likeCount >= minLikes);
                // If no videos pass the filter, use all videos
                if (filteredVideos.length === 0) {
                    filteredVideos = videos;
                }
                // Sort by engagement score
                const getScore = (v) => {
                    const viewScore = Math.log10(v.viewCount + 1) * 2;
                    const likeScore = Math.log10(v.likeCount + 1) * 3;
                    const commentScore = Math.log10(v.commentCount + 1) * 1.5;
                    return viewScore + likeScore + commentScore;
                };
                const sortedVideos = filteredVideos.sort((a, b) => getScore(b) - getScore(a)).slice(0, maxResults);

            // Cache the results
            this.cache.set(cacheKey, {
                timestamp: Date.now(),
                data: sortedVideos
            });
            return sortedVideos;
        } catch (error) {
            console.error('YouTube API error:', error);
            throw error;
        }
    }
}

module.exports = new YouTubeClient();
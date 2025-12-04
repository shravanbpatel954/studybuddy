const axios = require('axios');
require('dotenv').config();

class YouTubeClient {
    constructor() {
        this.apiKey = process.env.YOUTUBE_API_KEY;
        this.baseURL = 'https://www.googleapis.com/youtube/v3';
        this.cache = new Map();
        this.cacheDuration = 30 * 60 * 1000; // 30 minutes
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
            const sortedVideos = videos
                .filter(video => {
                    // Filter out videos with very low engagement
                    const minViews = 1000;
                    const minLikes = 100;
                    return video.viewCount >= minViews || video.likeCount >= minLikes;
                })
                .sort((a, b) => {
                    // Calculate engagement score (customizable formula)
                    const getScore = (v) => {
                        const viewScore = Math.log10(v.viewCount + 1) * 2;
                        const likeScore = Math.log10(v.likeCount + 1) * 3;
                        const commentScore = Math.log10(v.commentCount + 1) * 1.5;
                        return viewScore + likeScore + commentScore;
                    };
                    return getScore(b) - getScore(a);
                })
                .slice(0, maxResults);

            // Cache the results
            this.cache.set(cacheKey, {
                timestamp: Date.now(),
                data: sortedVideos
            });
        } catch (error) {
            console.error('YouTube API error:', error);
            throw error;
        }
    }
}

module.exports = new YouTubeClient();
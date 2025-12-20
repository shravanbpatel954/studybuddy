require('dotenv').config();

class YouTubeHelper {
    constructor() {
        this.API_KEY = process.env.YOUTUBE_API_KEY;
        this.educationalShorts = [
            { id: 'YOUR_SHORT_ID_1', topic: 'ai' },
            { id: 'YOUR_SHORT_ID_2', topic: 'ai' },
            // Add more shorts IDs here
        ];
    }

    getRandomShort(topic = 'ai') {
        const topicShorts = this.educationalShorts.filter(s => s.topic === topic);
        if (topicShorts.length === 0) return this.educationalShorts[0];
        
        const randomShort = topicShorts[Math.floor(Math.random() * topicShorts.length)];
        return {
            embedUrl: `https://www.youtube.com/embed/${randomShort.id}`,
            videoId: randomShort.id
        };
    }
}

module.exports = new YouTubeHelper();
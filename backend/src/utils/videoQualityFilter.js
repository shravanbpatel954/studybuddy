function normalizeText(text = '') {
    return text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

function similarityScore(title, topic) {
    const tWords = new Set(normalizeText(title).split(' ').filter(Boolean));
    const qWords = new Set(normalizeText(topic).split(' ').filter(Boolean));
    if (tWords.size === 0 || qWords.size === 0) return 0;
    let match = 0;
    qWords.forEach(w => {
        if (tWords.has(w)) match += 1;
    });
    return (match / qWords.size) * 100; // percentage
}

function isBlocked(title) {
    const blocked = ['scraping', 'web scraping', 'automation', 'ethical hacking', 'hacking'];
    const t = normalizeText(title);
    return blocked.some(b => t.includes(normalizeText(b)));
}

function filterQualityVideos(videos = [], topic = '') {
    const eduChannels = ['academy', 'education', 'educational', 'university', 'college', 'school', 'learning'];
    const topicNorm = normalizeText(topic);

    const scored = videos
        .filter(v => {
            if (!v || !v.title) return false;
            if (isBlocked(v.title)) return false;
            const durationMin = (v.durationSec || 0) / 60;
            if (durationMin < 2) return false;
            if ((v.viewCount || 0) < 1000) return false;
            const sim = similarityScore(v.title, topicNorm);
            if (sim < 40) return false;

            // channel credibility: allow if channel has edu keywords OR views > 10k
            const channelName = normalizeText(v.channelTitle || '');
            const credible = eduChannels.some(k => channelName.includes(k)) || (v.viewCount || 0) > 10000;
            if (!credible) return false;
            return true;
        })
        .map(v => {
            const durationMin = (v.durationSec || 0) / 60;
            const sim = similarityScore(v.title, topicNorm);
            const channelName = normalizeText(v.channelTitle || '');
            let score = 0;
            if (eduChannels.some(k => channelName.includes(k))) score += 5;
            if ((v.viewCount || 0) > 50000) score += 3;
            if (durationMin >= 6 && durationMin <= 20) score += 2;
            if (sim >= 60) score += 3;
            return { ...v, score };
        })
        .sort((a, b) => (b.score || 0) - (a.score || 0));

    return scored;
}

module.exports = { filterQualityVideos };


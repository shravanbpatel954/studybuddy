const User = require('../models/User.mdoels');

class LeaderboardController {
    // GET /api/leaderboard?limit=10
    async top(req, res) {
        try {
            const limit = Math.min(100, parseInt(req.query.limit) || 10);
            // Return top users sorted by points descending
            // Filter out users with null/undefined points and ensure points is a number
            const users = await User.find(
                { 
                    points: { $exists: true, $ne: null },
                    $or: [
                        { displayName: { $exists: true, $ne: '' } },
                        { email: { $exists: true, $ne: '' } }
                    ]
                }, 
                { displayName: 1, photo: 1, points: 1, email: 1, _id: 1 }
            )
            .sort({ points: -1 }) // Sort by points descending
            .limit(limit)
            .lean();
            
            // Ensure points are numbers and sort again as a safety measure
            const sortedUsers = users
                .map(u => ({ ...u, points: Number(u.points) || 0 }))
                .sort((a, b) => b.points - a.points);
            
            console.log(`Leaderboard: Returning ${sortedUsers.length} users (limit: ${limit})`);
            return res.json({ success: true, leaderboard: sortedUsers });
        } catch (err) {
            console.error('Leaderboard.top error', err);
            return res.status(500).json({ success: false, error: err.message });
        }
    }

    // GET /api/leaderboard/me - returns user's rank and neighbors
    async me(req, res) {
        try {
            const userId = req.user && (req.user._id || req.user);
            if (!userId) return res.status(401).json({ success: false, error: 'Not authenticated' });

            const user = await User.findById(userId).lean();
            if (!user) return res.status(404).json({ success: false, error: 'User not found' });

            const userPoints = Number(user.points) || 0;

            // Count users with more points to get rank
            const higherCount = await User.countDocuments({ 
                points: { $exists: true, $ne: null, $gt: userPoints } 
            });
            const rank = higherCount + 1;

            // Get a small window around user
            const before = await User.find(
                { points: { $exists: true, $ne: null, $gt: userPoints } }, 
                { displayName: 1, points: 1, email: 1, _id: 1 }
            )
            .sort({ points: -1 })
            .limit(3)
            .lean();
            
            const after = await User.find(
                { points: { $exists: true, $ne: null, $lt: userPoints } }, 
                { displayName: 1, points: 1, email: 1, _id: 1 }
            )
            .sort({ points: -1 })
            .limit(3)
            .lean();

            return res.json({ 
                success: true, 
                user: { 
                    id: user._id, 
                    displayName: user.displayName, 
                    email: user.email,
                    points: userPoints, 
                    rank 
                }, 
                before, 
                after 
            });
        } catch (err) {
            console.error('Leaderboard.me error', err);
            return res.status(500).json({ success: false, error: err.message });
        }
    }
}

module.exports = new LeaderboardController();

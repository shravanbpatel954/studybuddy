const User = require('../models/User.mdoels');
const gamesConfig = require('../config/games.config');
const { ensureUserFields } = require('./userHelpers');

/**
 * Compute earned points for a quiz attempt and apply them to the user.
 *
 * @param {Object} opts
 * @param {String} opts.userId - Mongo user id
 * @param {Number} opts.correct - number of correct answers
 * @param {Number} opts.totalQuestions - total questions in attempt
 * @param {Number} opts.timeMs - total time in ms for the attempt
 * @returns {Object} { success, earned, unlocked, newPoints }
 */
async function awardPointsForAttempt({ userId, correct = 0, totalQuestions = 0, timeMs = 0 }) {
    try {
        if (!userId) return { success: false, error: 'userId required' };

        const user = await User.findById(userId);
        if (!user) return { success: false, error: 'user not found' };

        // Ensure points and unlockedGames fields exist
        await ensureUserFields(user);

        const normalizedCorrect = parseInt(correct, 10) || 0;
        const normalizedTotal = parseInt(totalQuestions, 10) || 0;

        // Basic points formula (kept compatible with existing logic)
        const base = (normalizedCorrect || 0) * 10;

        const avgTimePerQ = normalizedTotal > 0 && typeof timeMs === 'number' ? (timeMs / normalizedTotal) / 1000 : 0;
        const speedBonusPerQ = Math.max(0, Math.floor((15 - avgTimePerQ) / 1));
        const speedBonus = Math.max(0, Math.min(10 * normalizedCorrect, speedBonusPerQ * normalizedCorrect));

        const earned = Math.max(0, Math.round(base + speedBonus));

        // Add points and log the change
        const oldPoints = typeof user.points === 'number' ? user.points : 0;
        user.points = oldPoints + earned;
        
        // Mark points as modified to ensure it's saved
        user.markModified('points');
        await user.save();
        
        // Verify the save worked
        const verifyUser = await User.findById(userId, { points: 1 }).lean();
        if (verifyUser && verifyUser.points !== user.points) {
            console.error(`[Points] Save verification failed! Expected ${user.points}, got ${verifyUser.points}`);
        }
        
        console.log(`[Points Change] User: ${user.email}`);
        console.log(`- Previous balance: ${oldPoints}`);
        console.log(`- Points earned: ${earned}`);
        console.log(`- New balance: ${user.points}`);

        console.log(`pointsHandler: user ${userId} awarded ${earned} points, newPoints: ${user.points}`);

        return { success: true, earned, newPoints: user.points };
    } catch (error) {
        console.error('pointsHandler.awardPointsForAttempt error:', error);
        return { success: false, error: error.message };
    }
}

module.exports = { awardPointsForAttempt };

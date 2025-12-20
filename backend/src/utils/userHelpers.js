/**
 * Utility functions to ensure user fields are always initialized
 */

const User = require('../models/User.models');

/**
 * Ensures a user document has points and unlockedGames fields initialized
 * This should be called whenever a user is fetched from the database
 * 
 * @param {Object} user - Mongoose user document
 * @returns {Promise<Object>} - The user document (saved if needed)
 */
async function ensureUserFields(user) {
    if (!user) return null;
    
    let needsSave = false;
    
    // Ensure points field exists and is a valid number
    if (typeof user.points !== 'number' || isNaN(user.points)) {
        user.points = 0;
        user.markModified('points');
        needsSave = true;
        console.log(`[UserHelper] Initialized points for user ${user._id} (${user.email || 'no email'}) to 0`);
    }
    
    // Ensure unlockedGames field exists and is a valid array
    if (!Array.isArray(user.unlockedGames) || user.unlockedGames.length === 0) {
        user.unlockedGames = ['Basket Hoop'];
        user.markModified('unlockedGames');
        needsSave = true;
        console.log(`[UserHelper] Initialized unlockedGames for user ${user._id} (${user.email || 'no email'})`);
    }
    
    if (needsSave) {
        try {
            await user.save();
            console.log(`[UserHelper] Saved user ${user._id} with initialized fields`);
        } catch (error) {
            console.error(`[UserHelper] Failed to save user ${user._id}:`, error);
        }
    }
    
    return user;
}

/**
 * Fetches a user by ID and ensures fields are initialized
 * 
 * @param {String|ObjectId} userId - User ID
 * @returns {Promise<Object|null>} - User document or null
 */
async function getUserWithInitializedFields(userId) {
    try {
        const user = await User.findById(userId);
        if (!user) return null;
        return await ensureUserFields(user);
    } catch (error) {
        console.error(`[UserHelper] Error fetching user ${userId}:`, error);
        return null;
    }
}

module.exports = {
    ensureUserFields,
    getUserWithInitializedFields
};


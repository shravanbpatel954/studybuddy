const GameMission = require('../models/GameMission.models');
const User = require('../models/User.models');
const gamesConfig = require('../config/games.config');

class GameController {
    // GET /api/game/missions
    async getMissions(req, res) {
        try {
            const userId = req.user?._id;
            if (!userId) return res.status(401).json({ success: false, error: 'Not authenticated' });

            // Get active missions
            const missions = await GameMission.find({
                userId,
                status: { $in: ['ACTIVE', 'COMPLETED'] },
                expiresAt: { $gt: new Date() }
            }).sort({ type: 1, createdAt: -1 });

            // Check if daily missions need to be generated
            const hasDailyMissions = missions.some(m => 
                m.type === 'DAILY' && 
                m.expiresAt > new Date()
            );

            if (!hasDailyMissions) {
                const newDailies = await GameMission.generateDailyMissions(userId);
                missions.push(...newDailies);
            }

            res.json({
                success: true,
                missions: missions.map(m => ({
                    id: m._id,
                    type: m.type,
                    category: m.category,
                    title: m.title,
                    description: m.description,
                    reward: m.reward,
                    progress: {
                        current: m.progress.completedSteps,
                        total: m.progress.totalSteps,
                        percentage: m.progressPercentage
                    },
                    status: m.status,
                    expiresAt: m.expiresAt
                }))
            });
        } catch (error) {
            console.error('GameController.getMissions error:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }

    // POST /api/game/missions/:id/claim
    async claimReward(req, res) {
        try {
            const userId = req.user?._id;
            const missionId = req.params.id;

            if (!userId) return res.status(401).json({ success: false, error: 'Not authenticated' });

            const mission = await GameMission.findOne({
                _id: missionId,
                userId,
                status: 'COMPLETED'
            });

            if (!mission) {
                return res.status(404).json({ 
                    success: false, 
                    error: 'Mission not found or not completed' 
                });
            }

            // Update mission status
            mission.status = 'CLAIMED';
            await mission.save();

            // Return reward details for frontend to handle
            res.json({
                success: true,
                reward: mission.reward
            });
        } catch (error) {
            console.error('GameController.claimReward error:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }

    // POST /api/game/progress/update
    async updateProgress(req, res) {
        try {
            const userId = req.user?._id;
            if (!userId) return res.status(401).json({ success: false, error: 'Not authenticated' });

            const { 
                eventType,
                value = 1,
                metadata = {}
            } = req.body;

            if (!eventType) {
                return res.status(400).json({
                    success: false,
                    error: 'Event type is required'
                });
            }

            // Find relevant active missions
            const missions = await GameMission.find({
                userId,
                status: 'ACTIVE',
                category: eventType,
                expiresAt: { $gt: new Date() }
            });

            // Update each relevant mission
            const updates = await Promise.all(missions.map(async mission => {
                // Check if event matches mission requirements
                if (mission.requirements.difficulty && 
                    mission.requirements.difficulty !== metadata.difficulty) {
                    return null;
                }
                
                if (mission.requirements.topic && 
                    mission.requirements.topic !== metadata.topic) {
                    return null;
                }

                // Update progress
                const completed = await mission.updateProgress(value);
                if (completed) {
                    return {
                        missionId: mission._id,
                        title: mission.title,
                        reward: mission.reward
                    };
                }
                return null;
            }));

            // Filter out null updates and return completed missions
            const completedMissions = updates.filter(Boolean);

            res.json({
                success: true,
                completedMissions
            });
        } catch (error) {
            console.error('GameController.updateProgress error:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }

    // GET /api/game/time-status
    // Check how much game time user has remaining
    async getTimeStatus(req, res) {
        try {
            const userId = req.user?._id;
            if (!userId) return res.status(401).json({ success: false, error: 'Not authenticated' });

            const user = await User.findById(userId);
            if (!user) return res.status(404).json({ success: false, error: 'User not found' });

            const now = new Date();
            const GAME_TIME_LIMIT_MS = 10 * 60 * 1000; // 10 minutes
            const RESET_INTERVAL_MS = 60 * 60 * 1000; // 60 minutes (1 hour)

            // Get window start time (when the current hour window began)
            let gameTimeWindowStart = user.gameTimeWindowStart ? new Date(user.gameTimeWindowStart) : null;
            let gameTimeUsedToday = user.gameTimeUsedToday || 0;

            // Check if we need to reset (more than 1 hour since window started)
            if (gameTimeWindowStart) {
                const timeSinceWindowStart = now - gameTimeWindowStart;
                if (timeSinceWindowStart >= RESET_INTERVAL_MS) {
                    // Reset: more than 1 hour has passed since window started
                    gameTimeUsedToday = 0;
                    gameTimeWindowStart = null;
                    user.gameTimeUsedToday = 0;
                    user.gameTimeWindowStart = null;
                    user.lastGamePlayTime = null;
                    await user.save();
                }
            }

            const remainingTime = Math.max(0, GAME_TIME_LIMIT_MS - gameTimeUsedToday);
            const canPlay = remainingTime > 0;
            
            // Calculate reset time: 1 hour from when the window started (or 1 hour from now if no window)
            const resetTime = gameTimeWindowStart 
                ? new Date(gameTimeWindowStart.getTime() + RESET_INTERVAL_MS)
                : new Date(now.getTime() + RESET_INTERVAL_MS);
            
            const resetInMs = Math.max(0, resetTime - now);
            const resetInMinutes = Math.floor(resetInMs / 60000);
            const resetInSeconds = Math.floor((resetInMs % 60000) / 1000);

            res.json({
                success: true,
                canPlay,
                remainingTimeMs: remainingTime,
                remainingTimeMinutes: Math.floor(remainingTime / 60000),
                remainingTimeSeconds: Math.floor((remainingTime % 60000) / 1000),
                timeUsedMs: gameTimeUsedToday,
                resetTime: resetTime.toISOString(),
                resetInMinutes: resetInMinutes,
                resetInSeconds: resetInSeconds,
                resetInMs: resetInMs
            });
        } catch (error) {
            console.error('getTimeStatus error:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }

    // POST /api/game/start
    // Start playing a game - checks time and updates tracking
    async startGame(req, res) {
        try {
            const userId = req.user?._id;
            if (!userId) return res.status(401).json({ success: false, error: 'Not authenticated' });

            const { gameName } = req.body;
            if (!gameName) {
                return res.status(400).json({ success: false, error: 'Game name required' });
            }

            const user = await User.findById(userId);
            if (!user) return res.status(404).json({ success: false, error: 'User not found' });

            // Check if game is unlocked
            if (!user.unlockedGames || !user.unlockedGames.includes(gameName)) {
                return res.status(403).json({ 
                    success: false, 
                    error: 'Game is locked. Unlock it with points first.' 
                });
            }

            const now = new Date();
            const GAME_TIME_LIMIT_MS = 10 * 60 * 1000; // 10 minutes
            const RESET_INTERVAL_MS = 60 * 60 * 1000; // 60 minutes

            // Get current time status
            let gameTimeWindowStart = user.gameTimeWindowStart ? new Date(user.gameTimeWindowStart) : null;
            let gameTimeUsedToday = user.gameTimeUsedToday || 0;

            // Check if we need to reset (more than 1 hour since window started)
            if (gameTimeWindowStart) {
                const timeSinceWindowStart = now - gameTimeWindowStart;
                if (timeSinceWindowStart >= RESET_INTERVAL_MS) {
                    // Reset: more than 1 hour has passed since window started
                    gameTimeUsedToday = 0;
                    gameTimeWindowStart = null;
                    user.gameTimeUsedToday = 0;
                    user.gameTimeWindowStart = null;
                    user.lastGamePlayTime = null;
                    await user.save();
                }
            }

            // If no window exists, start one now (first time playing or after reset)
            if (!gameTimeWindowStart) {
                gameTimeWindowStart = now;
                user.gameTimeWindowStart = now;
                // Reset time used when starting a new window
                gameTimeUsedToday = 0;
                user.gameTimeUsedToday = 0;
            }

            // Check if user has time remaining
            const remainingTime = GAME_TIME_LIMIT_MS - gameTimeUsedToday;
            if (remainingTime <= 0) {
                const resetTime = new Date(gameTimeWindowStart.getTime() + RESET_INTERVAL_MS);
                const resetInMs = Math.max(0, resetTime - now);
                const resetInMinutes = Math.ceil(resetInMs / 60000);
                const resetInSeconds = Math.ceil((resetInMs % 60000) / 1000);
                
                return res.status(403).json({
                    success: false,
                    error: 'Game time limit reached',
                    canPlay: false,
                    resetTime: resetTime.toISOString(),
                    resetInMinutes: resetInMinutes,
                    resetInSeconds: resetInSeconds
                });
            }

            // Update tracking
            user.lastGamePlayTime = now;
            await user.save();

            const resetTime = new Date(gameTimeWindowStart.getTime() + RESET_INTERVAL_MS);
            const resetInMs = Math.max(0, resetTime - now);
            const resetInMinutes = Math.floor(resetInMs / 60000);
            const resetInSeconds = Math.floor((resetInMs % 60000) / 1000);

            res.json({
                success: true,
                gameName,
                startTime: now.toISOString(),
                remainingTimeMs: remainingTime,
                remainingTimeMinutes: Math.floor(remainingTime / 60000),
                remainingTimeSeconds: Math.floor((remainingTime % 60000) / 1000),
                resetTime: resetTime.toISOString(),
                resetInMinutes: resetInMinutes,
                resetInSeconds: resetInSeconds,
                resetInMs: resetInMs,
                canPlay: true
            });
        } catch (error) {
            console.error('startGame error:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }

    // POST /api/game/end
    // End playing a game - updates time used
    async endGame(req, res) {
        try {
            const userId = req.user?._id;
            if (!userId) return res.status(401).json({ success: false, error: 'Not authenticated' });

            const { gameName, timePlayedMs } = req.body;
            if (!gameName || typeof timePlayedMs !== 'number') {
                return res.status(400).json({ 
                    success: false, 
                    error: 'Game name and time played (ms) required' 
                });
            }

            const user = await User.findById(userId);
            if (!user) return res.status(404).json({ success: false, error: 'User not found' });

            const now = new Date();
            const GAME_TIME_LIMIT_MS = 10 * 60 * 1000; // 10 minutes
            const RESET_INTERVAL_MS = 60 * 60 * 1000; // 60 minutes

            // Get current time status
            let gameTimeWindowStart = user.gameTimeWindowStart ? new Date(user.gameTimeWindowStart) : null;
            let gameTimeUsedToday = user.gameTimeUsedToday || 0;

            // Check if we need to reset (more than 1 hour since window started)
            if (gameTimeWindowStart) {
                const timeSinceWindowStart = now - gameTimeWindowStart;
                if (timeSinceWindowStart >= RESET_INTERVAL_MS) {
                    // Reset: more than 1 hour has passed since window started
                    gameTimeUsedToday = 0;
                    gameTimeWindowStart = now; // Start new window
                    user.gameTimeUsedToday = 0;
                    user.gameTimeWindowStart = now;
                }
            } else {
                // No window exists, start one now (first time playing)
                gameTimeWindowStart = now;
                user.gameTimeWindowStart = now;
                gameTimeUsedToday = 0;
                user.gameTimeUsedToday = 0;
            }

            // Update time used (cap at limit)
            const actualTimePlayed = Math.min(timePlayedMs, GAME_TIME_LIMIT_MS - gameTimeUsedToday);
            gameTimeUsedToday = Math.min(GAME_TIME_LIMIT_MS, gameTimeUsedToday + actualTimePlayed);

            user.gameTimeUsedToday = gameTimeUsedToday;
            user.lastGamePlayTime = now;
            await user.save();

            const remainingTime = GAME_TIME_LIMIT_MS - gameTimeUsedToday;
            const resetTime = new Date(gameTimeWindowStart.getTime() + RESET_INTERVAL_MS);
            const resetInMs = Math.max(0, resetTime - now);
            const resetInMinutes = Math.ceil(resetInMs / 60000);

            res.json({
                success: true,
                timePlayedMs: actualTimePlayed,
                totalTimeUsedMs: gameTimeUsedToday,
                remainingTimeMs: remainingTime,
                resetTime: resetTime.toISOString(),
                resetInMinutes: resetInMinutes
            });
        } catch (error) {
            console.error('endGame error:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }

    // POST /api/game/score
    // body: { totalQuestions, correctAnswers, timeTakenSeconds }
    async submitScore(req, res) {
        try {
            const userId = req.user?._id;
            if (!userId) return res.status(401).json({ success: false, error: 'Not authenticated' });

            const { totalQuestions = 0, correctAnswers = 0, timeTakenSeconds = 0 } = req.body || {};

            const tq = Number(totalQuestions) || 0;
            const correct = Number(correctAnswers) || 0;
            const timeSec = Number(timeTakenSeconds) || 0;

            // Basic scoring formula: 10 points per correct answer + speed bonus
            const base = correct * 10;
            const avgTimePerQ = tq > 0 ? (timeSec / tq) : 0;
            // speed bonus: faster than 15s per question gives up to +10 per question
            const speedBonusPerQ = Math.max(0, Math.floor((15 - avgTimePerQ) / 1));
            const speedBonus = Math.max(0, Math.min(10 * correct, speedBonusPerQ * correct));

            const earned = base + speedBonus;

            // Update user points
            const user = await User.findById(userId);
            if (!user) return res.status(404).json({ success: false, error: 'User not found' });

            // Ensure points field exists
            if (typeof user.points !== 'number' || isNaN(user.points)) {
                user.points = 0;
            }

            user.points = user.points + earned;
            user.markModified('points');

            // Auto-unlock while user has enough points
            const unlockCost = gamesConfig.unlockCost ?? 950;
            const availableGames = gamesConfig.games || [];
            const locked = availableGames.filter(g => !(user.unlockedGames || []).includes(g));
            const unlockedNow = [];

            while ((user.points || 0) >= unlockCost && locked.length > 0) {
                // pick random locked game
                const idx = Math.floor(Math.random() * locked.length);
                const pick = locked.splice(idx, 1)[0];
                user.unlockedGames = user.unlockedGames || [];
                user.unlockedGames.push(pick);
                user.points -= unlockCost; // spend points
                unlockedNow.push(pick);
            }

            await user.save();

            return res.json({ success: true, earned, points: user.points, unlocked: unlockedNow, unlockedGames: user.unlockedGames });
        } catch (error) {
            console.error('submitScore error:', error);
            return res.status(500).json({ success: false, error: error.message });
        }
    }

    // POST /api/v1/game/unlock
    // body: { }
    // Manually spend points to unlock a random locked game
    async unlockRandom(req, res) {
        try {
            const userId = req.user?._id;
            if (!userId) {
                return res.status(401).json({ success: false, error: 'Not authenticated' });
            }

            const user = await User.findById(userId);
            if (!user) {
                return res.status(404).json({ success: false, error: 'User not found' });
            }

            // Ensure points and unlockedGames fields exist
            if (typeof user.points !== 'number' || isNaN(user.points)) {
                user.points = 0;
            }
            if (!Array.isArray(user.unlockedGames)) {
                user.unlockedGames = ['Basket Hoop'];
            }

            // Get unlock cost from config (default to 950 if not set)
            const unlockCost = gamesConfig.unlockCost ?? 950;
            
            console.log(`Unlock attempt - Cost: ${unlockCost}, User points: ${user.points}`); // Debug log
            
            // Check if user has enough points
            if (user.points < unlockCost) {
                return res.status(400).json({ 
                    success: false, 
                    error: 'Not enough points to unlock a game',
                    required: unlockCost,
                    current: user.points
                });
            }

            // Get available games from config
            const availableGames = gamesConfig.games || [];
            
            // Filter out already unlocked games
            const locked = availableGames.filter(g => !user.unlockedGames.includes(g));
            
            if (locked.length === 0) {
                return res.status(400).json({ 
                    success: false, 
                    error: 'No locked games remaining',
                    unlockedGames: user.unlockedGames
                });
            }

            // Pick a truly random locked game using improved random selection
            // Use Math.random() directly for better randomness distribution
            const randomIndex = Math.floor(Math.random() * locked.length);
            const pick = locked[randomIndex];

            // Deduct points and unlock game
            user.points = user.points - unlockCost;
            user.unlockedGames.push(pick);
            user.markModified('points');
            user.markModified('unlockedGames');
            await user.save();

            console.log(`User ${userId} unlocked game "${pick}" for ${unlockCost} points. Remaining points: ${user.points}`);

            return res.json({ 
                success: true, 
                unlocked: pick, 
                points: user.points, 
                unlockedGames: user.unlockedGames 
            });
        } catch (error) {
            console.error('unlockRandom error:', error);
            return res.status(500).json({ success: false, error: error.message || 'Failed to unlock game' });
        }
    }
}

module.exports = new GameController();

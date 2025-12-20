const QuizGenerator = require('../utils/quizGenerator');
const UserProgress = require('../models/UserProgress.models');
const QuizAttempt = require('../models/QuizAttempt.models');
const UserQuiz = require('../models/UserQuiz.models');
const Module = require('../models/Module.models');
const YouTubeClient = require('../utils/youtubeClient');
const User = require('../models/User.models');
const gamesConfig = require('../config/games.config');
const pointsHandler = require('../utils/pointsHandler');
const { filterQualityVideos } = require('../utils/videoQualityFilter');
const { generateAutoExplanation } = require('../utils/autoExplanationGenerator');
const { generateFlashcardExplanation } = require('../utils/flashcardExplanationGenerator');

// Utility to shuffle options while keeping correct answer text intact (Fisher-Yates)
function shuffleOptions(options = []) {
    const arr = [...(options || [])];
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

class QuizController {
    // POST /api/quiz/next
    // DO NOT generate quiz - only continue existing quiz
    async next(req, res) {
        try {
            const userId = req.user?._id;
            if (!userId) {
                return res.status(401).json({ success: false, error: 'User not authenticated' });
            }
            const { subsectionId, difficulty } = req.body;
            
            if (!subsectionId) return res.status(400).json({ success: false, error: 'subsectionId required' });

            const quizDifficulty = difficulty || 'beginner';

            // Find existing quiz for this user/subsection/difficulty
            let userQuiz = await UserQuiz.findOne({ userId, subsectionId, difficulty: quizDifficulty });

            if (!userQuiz) {
                return res.status(404).json({ 
                    success: false, 
                    error: 'Quiz not found. Please generate quiz first.',
                    needsGeneration: true
                });
            }

            // Get next question from existing quiz
            const nextQuestion = userQuiz.getNextQuestion();

            if (!nextQuestion) {
                // Quiz completed - return completion status
                return res.json({ 
                    success: true, 
                    completed: true,
                    message: 'Quiz completed',
                    difficulty: quizDifficulty
                });
            }

            // Shuffle options for this question
            const shuffledOptions = shuffleOptions([...nextQuestion.options]);
            const questionWithShuffled = {
                ...nextQuestion.toObject(),
                options: shuffledOptions
            };

            // Load or create progress for flashcard
            let progress = await UserProgress.findOne({ userId, subsectionId });
            if (!progress) {
                progress = await UserProgress.create({ userId, subsectionId, difficulty: quizDifficulty, attempts: [] });
            }

            // Generate flashcard for this question (concept-based)
            let flashcard = null;
            try {
                const module = await Module.findOne({ 'chapters.sections.subsections._id': subsectionId });
                if (module) {
                    for (const ch of module.chapters || []) {
                        for (const sec of ch.sections || []) {
                            const sub = (sec.subsections || []).find(s => s._id.toString() === subsectionId);
                            if (sub) {
                                const content = (sub.content && [sub.content.description].concat(sub.content.key_points||[], sub.content.examples||[]).join('\n')) || '';
                                if (content) {
                                    flashcard = await QuizGenerator.generateConceptFlashcard(content, nextQuestion.topic || nextQuestion.question);
                                }
                                break;
                            }
                        }
                        if (flashcard) break;
                    }
                }
            } catch (flashcardError) {
                console.warn('Failed to generate flashcard:', flashcardError.message);
                // Continue without flashcard
            }

            // Update last seen
            progress.lastSeenAt = new Date();
            await progress.save();

            return res.json({ 
                success: true, 
                next_type: 'mcq_then_flashcard', 
                mcq: questionWithShuffled, 
                flashcard: flashcard,
                difficulty: quizDifficulty,
                currentIndex: userQuiz.currentIndex,
                totalQuestions: userQuiz.questions.length
            });
        } catch (error) {
            console.error('QuizController.next error:', error);
            return res.status(500).json({ success: false, error: error.message });
        }
    }

    // POST /api/quiz/answer
    async answer(req, res) {
        try {
            const userId = req.user?._id;
            if (!userId) {
                return res.status(401).json({ success: false, error: 'User not authenticated' });
            }
            const { subsectionId, correct, questionId, selectedAnswer, flashcardId, difficulty } = req.body;
            if (!userId) return res.status(401).json({ success: false, error: 'User not authenticated' });

            const quizDifficulty = difficulty || 'beginner';
            
            // Server-side validation: verify answer correctness if we have questionId
            let verifiedCorrect = correct;
            if (questionId && selectedAnswer && subsectionId) {
                try {
                    const userQuiz = await UserQuiz.findOne({ userId, subsectionId, difficulty: quizDifficulty });
                    if (userQuiz && userQuiz.questions) {
                        const question = userQuiz.questions.find(q => q.id === questionId || q._id?.toString() === questionId);
                        if (question && question.correctAnswer) {
                            // Normalize for comparison
                            const normalize = (str) => String(str || '').trim().toLowerCase();
                            verifiedCorrect = normalize(selectedAnswer) === normalize(question.correctAnswer);
                            if (verifiedCorrect !== correct) {
                                console.log(`[Answer Check] Mismatch: frontend said ${correct}, server verified ${verifiedCorrect}`);
                            }
                        }
                    }
                } catch (verifyError) {
                    console.warn('Answer verification failed:', verifyError);
                    // Use frontend value if verification fails
                }
            }

            // Advance the quiz index (only if we have a quiz)
            if (subsectionId) {
                const userQuiz = await UserQuiz.findOne({ userId, subsectionId, difficulty: quizDifficulty });
                if (userQuiz) {
                    userQuiz.advance();
                    await userQuiz.save();
                }
            }

            let progress = await UserProgress.findOne({ userId, subsectionId });
            if (!progress) progress = await UserProgress.create({ userId, subsectionId, difficulty: quizDifficulty, attempts: [] });

            // Update streaks, mastery and XP with enhanced progression
            // Use verified correct value
            if (verifiedCorrect) {
                progress.consecutiveCorrect = (progress.consecutiveCorrect || 0) + 1;
                progress.consecutiveWrong = 0;
                
                // More mastery points for higher difficulties
                const masteryPoints = {
                    'beginner': 3,
                    'intermediate': 5,
                    'advanced': 8,
                    'expert': 12
                }[progress.difficulty] || 5;
                
                progress.mastery = Math.min(100, (progress.mastery || 0) + masteryPoints);
                
                // More XP for higher difficulties and streaks
                const xpMultiplier = {
                    'beginner': 1,
                    'intermediate': 1.5,
                    'advanced': 2,
                    'expert': 3
                }[progress.difficulty] || 1;
                
                const streakBonus = Math.floor(progress.streak / 5) * 0.2; // 20% bonus every 5 streak
                progress.xp = (progress.xp || 0) + Math.round(10 * xpMultiplier * (1 + streakBonus));
                progress.streak = (progress.streak || 0) + 1;
                
                // Progress difficulty based on consecutive correct answers
                if (progress.consecutiveCorrect >= 3) {
                    const difficultyOrder = ['beginner', 'intermediate', 'advanced', 'expert'];
                    const currentIndex = difficultyOrder.indexOf(progress.difficulty);
                    if (currentIndex < difficultyOrder.length - 1) {
                        progress.difficulty = difficultyOrder[currentIndex + 1];
                        progress.consecutiveCorrect = 0; // Reset after promotion
                    }
                }
            } else {
                progress.consecutiveWrong = (progress.consecutiveWrong || 0) + 1;
                progress.consecutiveCorrect = 0;
                progress.mastery = Math.max(0, (progress.mastery || 0) - 2);
                progress.streak = 0;
                
                // Demote difficulty after consecutive wrong answers
                if (progress.consecutiveWrong >= 2) {
                    const difficultyOrder = ['beginner', 'intermediate', 'advanced', 'expert'];
                    const currentIndex = difficultyOrder.indexOf(progress.difficulty);
                    if (currentIndex > 0) {
                        progress.difficulty = difficultyOrder[currentIndex - 1];
                        progress.consecutiveWrong = 0; // Reset after demotion
                    }
                }
            }

            // Flashcard spaced repetition handling
            if (flashcardId) {
                progress.flashcardSchedule = progress.flashcardSchedule || [];
                const fid = flashcardId?.toString();
                let entry = progress.flashcardSchedule.find(e => e.flashcardId && e.flashcardId.toString() === fid);
                if (!entry) {
                    entry = { flashcardId: fid, nextReviewAt: new Date(), intervalSecs: 0, easeFactor: 2.5 };
                    progress.flashcardSchedule.push(entry);
                }

                const now = Date.now();
                if (correct) {
                    const prevDays = Math.max(0, Math.round((entry.intervalSecs || 0) / 86400));
                    let nextDays;
                    if (prevDays === 0) nextDays = 1;
                    else if (prevDays === 1) nextDays = 6;
                    else nextDays = Math.max(1, Math.round(prevDays * (entry.easeFactor || 2.5)));
                    entry.easeFactor = Math.max(1.3, (entry.easeFactor || 2.5) + 0.1);
                    entry.intervalSecs = nextDays * 86400;
                    entry.nextReviewAt = new Date(now + entry.intervalSecs * 1000);
                } else {
                    entry.intervalSecs = 86400;
                    entry.easeFactor = Math.max(1.3, (entry.easeFactor || 2.5) - 0.2);
                    entry.nextReviewAt = new Date(now + entry.intervalSecs * 1000);
                }
            }

            progress.lastSeenAt = new Date();
            await progress.save();

            // Award points immediately for each correct answer
            let pointsEarned = 0;
            let newPointsTotal = 0;
            if (verifiedCorrect) {
                try {
                    // Directly update user points (simpler and more reliable)
                    const User = require('../models/User.models');
                    const { ensureUserFields } = require('../utils/userHelpers');
                    const user = await User.findById(userId);
                    if (user) {
                        await ensureUserFields(user);
                        const oldPoints = typeof user.points === 'number' ? user.points : 0;
                        const basePoints = 10; // 10 points per correct answer
                        user.points = oldPoints + basePoints;
                        user.markModified('points');
                        await user.save();
                        
                        // Verify save
                        const verifyUser = await User.findById(userId, { points: 1 }).lean();
                        if (verifyUser) {
                            pointsEarned = basePoints;
                            newPointsTotal = verifyUser.points || user.points;
                            console.log(`[Points] ✅ Immediate points awarded: ${pointsEarned} points. Old: ${oldPoints}, New: ${newPointsTotal}`);
                        } else {
                            console.error('[Points] ❌ Failed to verify points save');
                        }
                    }
                } catch (pointsError) {
                    console.error('[Points] Failed to award immediate points:', pointsError);
                }
            }

            return res.json({ 
                success: true, 
                mastery: progress.mastery, 
                xp: progress.xp,
                correct: verifiedCorrect,
                verified: true,
                pointsEarned: pointsEarned,
                newPointsTotal: newPointsTotal
            });
        } catch (error) {
            console.error('QuizController.answer error:', error);
            return res.status(500).json({ success: false, error: error.message });
        }
    }

    // POST /api/quiz/explain
    // Generate a rich flashcard-style explanation for a given MCQ using AI orchestrator.
    async explain(req, res) {
        try {
            const userId = req.user?._id;
            if (!userId) {
                return res.status(401).json({ success: false, error: 'User not authenticated' });
            }

            const {
                subsectionId,
                questionId,
                question,
                options = [],
                correctAnswer,
                selectedAnswer,
                originalExplanation = '',
                topic = '',
                difficulty = 'intermediate'
            } = req.body || {};

            if (!question && !topic) {
                return res.status(400).json({ success: false, error: 'Question text or topic is required' });
            }

            // Try to load module/subsection content for additional context
            let moduleContext = '';
            if (subsectionId) {
                try {
                    const module = await Module.findOne({ 'chapters.sections.subsections._id': subsectionId });
                    if (module) {
                        for (const ch of module.chapters || []) {
                            for (const sec of ch.sections || []) {
                                const sub = (sec.subsections || []).find(s => s._id.toString() === subsectionId);
                                if (sub && sub.content) {
                                    const parts = [
                                        sub.content.description || '',
                                        ...(sub.content.key_points || []),
                                        ...(sub.content.examples || [])
                                    ];
                                    moduleContext = parts.join('\n');
                                    break;
                                }
                            }
                            if (moduleContext) break;
                        }
                    }
                } catch (ctxErr) {
                    console.warn('QuizController.explain: failed to load module context:', ctxErr.message);
                }
            }

            const aiResult = await generateFlashcardExplanation({
                question,
                options,
                correctAnswer,
                selectedAnswer,
                originalExplanation,
                topic,
                moduleContext,
                difficulty,
                userId,
                subsectionId
            });

            return res.json({
                success: true,
                flashcard: {
                    question,
                    correctAnswer,
                    explanation: aiResult.explanation || originalExplanation,
                    insight: aiResult.insight || '',
                    resources: aiResult.resources || {},
                    questionId,
                    topic
                }
            });
        } catch (error) {
            console.error('QuizController.explain error:', error);
            return res.status(500).json({ success: false, error: error.message });
        }
    }

    // GET /api/quiz/progress/:subsectionId
    async getProgress(req, res) {
        try {
            const userId = req.user?._id;
            const { subsectionId } = req.params;

            if (!userId) return res.status(401).json({ success: false, error: 'User not authenticated' });
            if (!subsectionId) return res.status(400).json({ success: false, error: 'subsectionId required' });

            console.log(`[getProgress] Fetching progress for user ${userId}, subsection ${subsectionId}`);
            
            const progress = await UserProgress.findOne({ userId, subsectionId }).lean();
            
            if (!progress) {
                console.log(`[getProgress] No progress found, returning empty`);
                return res.json({ success: true, progress: { difficulty: 'beginner', mastery: 0, attempts: [], lastAttemptAt: null } });
            }

            // Ensure attempts are sorted by date (newest first) and properly formatted
            let attempts = progress.attempts || [];
            console.log(`[getProgress] Found ${attempts.length} raw attempts`);
            
            if (Array.isArray(attempts) && attempts.length > 0) {
                attempts = attempts
                    .map(attempt => ({
                        date: attempt.date || attempt.completedAt || new Date(),
                        difficulty: attempt.difficulty || 'beginner',
                        score: attempt.score || 0,
                        totalQuestions: attempt.totalQuestions || 0,
                        timeMs: attempt.timeMs || null,
                        attemptedQuestions: attempt.attemptedQuestions || []
                    }))
                    .sort((a, b) => {
                        const dateA = new Date(a.date).getTime();
                        const dateB = new Date(b.date).getTime();
                        return dateB - dateA; // Newest first
                    });
            }
            
            console.log(`[getProgress] ✅ Returning ${attempts.length} formatted attempts`);
            
            return res.json({ success: true, progress: {
                difficulty: progress.difficulty || 'beginner',
                mastery: progress.mastery || 0,
                attempts: attempts,
                lastAttemptAt: progress.lastSeenAt,
                xp: progress.xp || 0,
                streak: progress.streak || 0
            }});
        } catch (error) {
            console.error('QuizController.getProgress error:', error);
            return res.status(500).json({ success: false, error: error.message });
        }
    }

    // GET /api/quiz/attempts/:subsectionId - Get all quiz attempts for download/viewing
    async getAttempts(req, res) {
        try {
            const userId = req.user?._id;
            const { subsectionId } = req.params;

            if (!userId) return res.status(401).json({ success: false, error: 'User not authenticated' });
            if (!subsectionId) return res.status(400).json({ success: false, error: 'subsectionId required' });

            const progress = await UserProgress.findOne({ userId, subsectionId });
            if (!progress || !progress.attempts || progress.attempts.length === 0) {
                return res.json({ success: true, attempts: [] });
            }

            // Sort attempts by date (newest first) and ensure proper formatting
            let attempts = [];
            if (Array.isArray(rawAttempts) && rawAttempts.length > 0) {
                attempts = rawAttempts
                    .map(attempt => ({
                        date: attempt.date || attempt.completedAt || new Date(),
                        difficulty: attempt.difficulty || 'beginner',
                        score: attempt.score || 0,
                        totalQuestions: attempt.totalQuestions || 0,
                        timeMs: attempt.timeMs || null,
                        attemptedQuestions: Array.isArray(attempt.attemptedQuestions) ? attempt.attemptedQuestions : []
                    }))
                    .sort((a, b) => {
                        const dateA = new Date(a.date);
                        const dateB = new Date(b.date);
                        return dateB - dateA; // Newest first
                    });
            }

            console.log(`[getAttempts] ✅ Returning ${attempts.length} formatted attempts for user ${userId}, subsection ${subsectionId}`);
            return res.json({ success: true, attempts });
        } catch (error) {
            console.error('QuizController.getAttempts error:', error);
            return res.status(500).json({ success: false, error: error.message });
        }
    }

    // GET /api/quiz/youtube-videos
    async getYouTubeVideos(req, res) {
        try {
            const { topic, max } = req.query;
            const userId = req.user?._id;
            if (!topic) return res.status(400).json({ success: false, error: 'Topic required' });
            if (!userId) return res.status(401).json({ success: false, error: 'User not authenticated' });

            const maxResults = Math.min(Math.max(parseInt(max) || 4, 1), 10);
            const videos = await YouTubeClient.searchVideos(topic, maxResults * 2);
            const filtered = (videos || []).slice(0, maxResults);

            if (!filtered.length) {
                return res.json({
                    success: true,
                    type: 'explanation',
                    content: `No relevant videos found for "${topic}" right now.`
                });
            }

            return res.json({ success: true, type: 'video', content: filtered });
        } catch (error) {
            console.error('QuizController.getYouTubeVideos error:', error);
            return res.status(500).json({ success: false, error: error.message });
        }
    }

    // GET /api/quiz/youtube-shorts
    async getYouTubeShorts(req, res) {
        try {
            const { topic, rewardType = 'completion' } = req.query;
            const userId = req.user?._id;
            
            if (!topic) return res.status(400).json({ success: false, error: 'Topic required' });
            if (!userId) return res.status(401).json({ success: false, error: 'User not authenticated' });

            // Get user's progress and detailed stats
            let progress = await UserProgress.findOne({ userId });
            if (!progress) {
                progress = await UserProgress.create({ 
                    userId, 
                    difficulty: 'beginner',
                    mastery: 0,
                    streak: 0,
                    attempts: []
                });
            }

            const userLevel = progress.difficulty || 'beginner';

            // Get engaging shorts with advanced features
            const shorts = await YouTubeClient.searchShorts(topic, 10);
            
            // Enhanced filtering with engagement metrics
            const enhancedShorts = shorts
                .filter(video => {
                    const minViews = {
                        beginner: 1000,
                        intermediate: 5000,
                        advanced: 10000,
                        expert: 20000
                    }[userLevel] || 1000;
                    
                    const minLikes = minViews * 0.1; // 10% of views as minimum likes
                    return video.viewCount >= minViews && video.likeCount >= minLikes;
                })
                .sort((a, b) => {
                    // Enhanced engagement scoring
                    const getScore = (v) => {
                        const age = (Date.now() - new Date(v.publishedAt).getTime()) / (1000 * 60 * 60 * 24);
                        const recencyBonus = Math.max(0, 1 - (age / 365)); // Bonus for newer content
                        
                        const viewScore = Math.log10(v.viewCount + 1) * 2;
                        const likeScore = Math.log10(v.likeCount + 1) * 3;
                        const commentScore = Math.log10(v.commentCount + 1) * 1.5;
                        const engagementRate = (v.likeCount + v.commentCount) / (v.viewCount || 1);
                        
                        return (viewScore + likeScore + commentScore) * 
                               (1 + engagementRate) * 
                               (1 + recencyBonus);
                    };
                    return getScore(b) - getScore(a);
                })
                .slice(0, 5);

            // Enhanced reward content
            const rewardContent = {
                completion: {
                    beginner: {
                        message: "🌟 Amazing progress! You're off to a fantastic start!",
                        theme: "growth",
                        quote: "Every expert was once a beginner. Keep going!",
                        animation: "celebration"
                    },
                    intermediate: {
                        message: "🚀 Outstanding work! You're really getting the hang of this!",
                        theme: "advancement",
                        quote: "Success is built one concept at a time!",
                        animation: "levelUp"
                    },
                    advanced: {
                        message: "💫 Incredible mastery! You're reaching new heights!",
                        theme: "mastery",
                        quote: "Excellence is not a destination; it's a continuous journey!",
                        animation: "achievement"
                    },
                    expert: {
                        message: "🏆 Phenomenal achievement! You're among the elite learners!",
                        theme: "excellence",
                        quote: "Knowledge is power, and you're becoming unstoppable!",
                        animation: "mastery"
                    }
                },
                streak: {
                    beginner: {
                        message: "🔥 Your learning streak is on fire! Keep it up!",
                        theme: "momentum",
                        quote: "Small steps every day lead to big achievements!",
                        animation: "streak"
                    },
                    intermediate: {
                        message: "⚡ Unstoppable! Your dedication is truly inspiring!",
                        theme: "dedication",
                        quote: "Consistency is the key to mastery!",
                        animation: "lightning"
                    },
                    advanced: {
                        message: "🌠 Legendary streak! You're making history!",
                        theme: "achievement",
                        quote: "Every day of learning adds to your greatness!",
                        animation: "fireworks"
                    },
                    expert: {
                        message: "🎯 Epic mastery streak! You're in a league of your own!",
                        theme: "legendary",
                        quote: "Excellence becomes a habit when practiced daily!",
                        animation: "trophy"
                    }
                }
            };

            // Calculate streak bonus
            const streakBonus = {
                xp: progress.streak >= 5 ? Math.floor(progress.streak / 5) * 10 : 0,
                multiplier: 1 + (Math.floor(progress.streak / 5) * 0.2) // 20% bonus per 5 day streak
            };

            // Get content for current level and type
            const content = rewardContent[rewardType]?.[userLevel] || rewardContent.completion.beginner;

            return res.json({
                success: true,
                ...content,
                shorts: enhancedShorts.map(video => ({
                    ...video,
                    engagement: {
                        views: this.formatCount(video.viewCount),
                        likes: this.formatCount(video.likeCount),
                        comments: this.formatCount(video.commentCount)
                    }
                })),
                streakBonus,
                userProgress: {
                    level: userLevel,
                    mastery: progress.mastery || 0,
                    streak: progress.streak || 0,
                    xp: progress.xp || 0
                },
                badges: this.getAchievementBadges(userLevel, progress),
                additionalResources: this.getAdditionalResources(topic, userLevel)
            });
        } catch (error) {
            console.error('QuizController.getYouTubeShorts error:', error);
            return res.status(500).json({ success: false, error: error.message });
        }
    }

    // Helper to format large numbers
    formatCount(count) {
        if (count >= 1000000) {
            return `${(count / 1000000).toFixed(1)}M`;
        } else if (count >= 1000) {
            return `${(count / 1000).toFixed(1)}K`;
        }
        return count.toString();
    }

    // Get additional learning resources
    getAdditionalResources(topic, userLevel) {
        return {
            beginner: [
                { type: 'practice', message: "Try these beginner-friendly exercises 📝" },
                { type: 'community', message: "Join our beginner study group! 👥" }
            ],
            intermediate: [
                { type: 'challenge', message: "Ready for some practice challenges? 🎯" },
                { type: 'project', message: "Start a hands-on project! 🛠️" }
            ],
            advanced: [
                { type: 'deepDive', message: "Explore advanced tutorials 📚" },
                { type: 'contribute', message: "Share your knowledge! 🌟" }
            ],
            expert: [
                { type: 'mentor', message: "Become a community mentor 👨‍🏫" },
                { type: 'create', message: "Create your own content! 🎥" }
            ]
        }[userLevel] || [];
    }

    getAchievementBadges(userLevel, progress) {
        const baseBadges = {
            beginner: {
                icon: "🌱",
                name: "Eager Learner",
                description: "Taking the first steps towards mastery!"
            },
            intermediate: {
                icon: "🌿",
                name: "Growing Scholar",
                description: "Building strong foundations of knowledge!"
            },
            advanced: {
                icon: "🌳",
                name: "Knowledge Master",
                description: "Reaching new heights of understanding!"
            },
            expert: {
                icon: "🎓",
                name: "Subject Expert",
                description: "Achieving excellence in learning!"
            }
        };

        // Add streak badges
        const badges = [baseBadges[userLevel]];
        
        if (progress.streak >= 3) {
            badges.push({
                icon: "🔥",
                name: "Streak Starter",
                description: "3 day learning streak!"
            });
        }
        if (progress.streak >= 7) {
            badges.push({
                icon: "⚡",
                name: "Week Warrior",
                description: "7 day learning streak!"
            });
        }
        if (progress.streak >= 30) {
            badges.push({
                icon: "🌟",
                name: "Monthly Master",
                description: "30 day learning streak!"
            });
        }

        // Add mastery badges
        if (progress.mastery >= 25) {
            badges.push({
                icon: "📚",
                name: "Knowledge Seeker",
                description: "25% subject mastery achieved!"
            });
        }
        if (progress.mastery >= 50) {
            badges.push({
                icon: "🎯",
                name: "Half Way Hero",
                description: "50% subject mastery achieved!"
            });
        }
        if (progress.mastery >= 75) {
            badges.push({
                icon: "💫",
                name: "Rising Star",
                description: "75% subject mastery achieved!"
            });
        }
        if (progress.mastery >= 100) {
            badges.push({
                icon: "👑",
                name: "Subject Champion",
                description: "100% subject mastery achieved!"
            });
        }

        return badges;
    }

    // POST /api/quiz/attempt (new, full attempt capture)
    async recordAttemptV2(req, res) {
        try {
            const userId = req.user?._id;
            if (!userId) {
                return res.status(401).json({ success: false, error: 'User not authenticated' });
            }

            const { quizId, answers = [], difficultyLevel = 'beginner', timeTaken = 0 } = req.body || {};
            if (!quizId) return res.status(400).json({ success: false, error: 'quizId required' });

            const totalQuestions = answers.length || 0;
            const correctAnswers = answers.filter(a => a && a.selectedOption === a.correctOption).length;
            const wrongAnswers = Math.max(0, totalQuestions - correctAnswers);
            const score = correctAnswers;

            const attemptDoc = await QuizAttempt.create({
                userId,
                quizId,
                score,
                totalQuestions,
                correctAnswers,
                wrongAnswers,
                difficultyLevel,
                answers: answers.map(a => ({
                    questionId: a.questionId,
                    selectedOption: a.selectedOption,
                    correctOption: a.correctOption,
                    isCorrect: a.selectedOption === a.correctOption
                })),
                timeTaken: typeof timeTaken === 'number' ? timeTaken : 0
            });

            return res.json({
                success: true,
                message: 'Attempt recorded',
                attempt: {
                    id: attemptDoc._id,
                    score,
                    totalQuestions,
                    correctAnswers,
                    wrongAnswers,
                    difficultyLevel,
                    timeTaken: attemptDoc.timeTaken
                }
            });
        } catch (error) {
            console.error('recordAttemptV2 error:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }

    // GET /api/quiz/history/:userId
    async getQuizHistory(req, res) {
        try {
            const { userId } = req.params;
            const requester = req.user?._id;
            if (!requester) return res.status(401).json({ success: false, error: 'User not authenticated' });
            if (!userId) return res.status(400).json({ success: false, error: 'userId required' });
            if (requester.toString() !== userId.toString()) {
                return res.status(403).json({ success: false, error: 'Forbidden' });
            }

            const attempts = await QuizAttempt.find({ userId })
                .sort({ attemptedAt: -1 })
                .limit(20)
                .select('quizId score totalQuestions correctAnswers wrongAnswers difficultyLevel timeTaken attemptedAt');

            return res.json({ success: true, attempts });
        } catch (error) {
            console.error('getQuizHistory error:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }

    // Development/test endpoints
    // Simple deterministic responses so router test endpoints don't break
    async test(req, res) {
        return res.json({ success: true, message: 'quiz test endpoint OK' });
    }

    async testAnswer(req, res) {
        // Accepts { correct: boolean } and returns a small simulated progress delta
        try {
            const { correct } = req.body || {};
            return res.json({ success: true, correct: !!correct, message: 'test answer received' });
        } catch (err) {
            return res.status(500).json({ success: false, error: err.message });
        }
    }

    // POST /api/quiz/attempt
    // Body: { subsectionId, score, totalQuestions, timeMs, attemptedQuestions }
    async attemptComplete(req, res) {
        try {
            console.log('Attempt complete request:', req.body);
            const userId = req.user?._id;
            if (!userId) {
                return res.status(401).json({ success: false, error: 'User not authenticated' });
            }
            const { subsectionId, score, totalQuestions, timeMs } = req.body;
            if (!userId) return res.status(401).json({ success: false, error: 'User not authenticated' });
            if (!subsectionId) return res.status(400).json({ success: false, error: 'subsectionId required' });

            let progress = await UserProgress.findOne({ userId, subsectionId });
            if (!progress) progress = await UserProgress.create({ userId, subsectionId, difficulty: 'beginner', attempts: [] });

            const normalizedScore = parseInt(score) || 0;
            const normalizedTotal = parseInt(totalQuestions) || 0;
            const correctAll = normalizedScore === normalizedTotal && normalizedTotal > 0;

            if (correctAll) {
                progress.consecutiveCorrect = (progress.consecutiveCorrect || 0) + 1;
                progress.consecutiveWrong = 0;
            } else {
                progress.consecutiveWrong = (progress.consecutiveWrong || 0) + 1;
                progress.consecutiveCorrect = 0;
            }

            // Ensure attempts array exists
            if (!Array.isArray(progress.attempts)) {
                progress.attempts = [];
            }
            
            const attemptedQuestions = Array.isArray(req.body.attemptedQuestions) ? req.body.attemptedQuestions : [];
            
            console.log(`[Attempt Save] Received attemptedQuestions:`, {
                count: attemptedQuestions.length,
                sample: attemptedQuestions.slice(0, 2)
            });
            
            const newAttempt = {
                date: new Date(),
                difficulty: progress.difficulty || 'beginner',
                score: normalizedScore,
                totalQuestions: normalizedTotal,
                timeMs: typeof timeMs === 'number' ? timeMs : null,
                attemptedQuestions: attemptedQuestions.slice(0, 200) // Store all attempted questions (up to 200)
            };
            
            console.log(`[Attempt Save] Creating attempt with complete data:`, {
                score: newAttempt.score,
                totalQuestions: newAttempt.totalQuestions,
                timeMs: newAttempt.timeMs,
                attemptedQuestionsCount: newAttempt.attemptedQuestions.length,
                difficulty: newAttempt.difficulty
            });
            
            console.log(`[Attempt Save] Creating new attempt:`, {
                score: normalizedScore,
                totalQuestions: normalizedTotal,
                difficulty: progress.difficulty,
                date: newAttempt.date,
                userId: userId.toString(),
                subsectionId: subsectionId.toString(),
                currentAttemptsCount: progress.attempts.length
            });
            
            // Add new attempt to array (keep last 50 to avoid unbounded growth)
            progress.attempts.push(newAttempt);
            if (progress.attempts.length > 50) {
                progress.attempts = progress.attempts.slice(-50);
            }
            
            // CRITICAL: Mark attempts array as modified BEFORE saving
            progress.markModified('attempts');
            
            console.log(`[Attempt Save] ✅ Pushed new attempt. Total attempts now: ${progress.attempts.length}`);

            // Update difficulty based on performance
            // 3+ correct answers = increase level
            // Less than 3 correct = stay in beginner but mark for easier questions next time
            if (normalizedScore >= 3 && normalizedTotal >= 3) {
                const order = ['beginner', 'intermediate', 'advanced', 'expert'];
                const currentIdx = order.indexOf(progress.difficulty || 'beginner');
                if (currentIdx >= 0 && currentIdx < order.length - 1) {
                    progress.difficulty = order[currentIdx + 1];
                    console.log(`[Difficulty] Promoted to ${progress.difficulty} (${normalizedScore}/${normalizedTotal} correct)`);
                }
            } else if (normalizedScore < 3 && normalizedTotal >= 3) {
                // Stay in beginner but mark that easier questions should be generated
                if (progress.difficulty !== 'beginner') {
                    progress.difficulty = 'beginner';
                    console.log(`[Difficulty] Demoted to beginner (${normalizedScore}/${normalizedTotal} correct)`);
                }
                // Mark for easier questions in next attempt
                progress.needsEasierQuestions = true;
            }

            progress.lastSeenAt = new Date();
            
            // CRITICAL: Mark attempts as modified again before save (double-check)
            progress.markModified('attempts');
            
            // Save with validation
            console.log(`[Attempt Save] Saving progress with ${progress.attempts.length} attempts...`);
            await progress.save();
            console.log(`[Attempt Save] ✅ Progress saved successfully`);
            
            // Verify the save by re-fetching
            const verifyProgress = await UserProgress.findOne({ userId, subsectionId }).lean();
            const savedAttemptsCount = verifyProgress?.attempts?.length || 0;
            if (verifyProgress) {
                console.log(`[Attempt Save] ✅ Verified: ${savedAttemptsCount} attempts saved for user ${userId}, subsection ${subsectionId}`);
                if (savedAttemptsCount > 0) {
                    const latestAttempt = verifyProgress.attempts[savedAttemptsCount - 1];
                    console.log(`[Attempt Save] Latest attempt details:`, {
                        date: latestAttempt.date,
                        score: latestAttempt.score,
                        totalQuestions: latestAttempt.totalQuestions,
                        difficulty: latestAttempt.difficulty
                    });
                } else {
                    console.error(`[Attempt Save] ❌ WARNING: No attempts found after save!`);
                }
            } else {
                console.error(`[Attempt Save] ❌ Failed to verify save for user ${userId}, subsection ${subsectionId}`);
            }

            // Also record attempt summary into Quiz model (best-effort)
            try {
                // Attempt to find module + sectionPath similar to generator usage
                if (subsectionId) {
                    const module = await Module.findOne({ 'chapters.sections.subsections._id': subsectionId });
                    if (module) {
                        let targetChapter = null;
                        let targetSection = null;
                        for (const chapter of module.chapters || []) {
                            for (const section of chapter.sections || []) {
                                const found = section.subsections.find(sub => sub._id.toString() === subsectionId);
                                if (found) {
                                    targetChapter = chapter;
                                    targetSection = section;
                                    break;
                                }
                            }
                            if (targetSection) break;
                        }

                        if (targetChapter && targetSection) {
                            const sectionPath = `${targetChapter.id}.${targetSection.id}.${subsectionId}`;
                            const quizDoc = await require('../utils/quizGenerator').constructor ? null : null; // placeholder to keep linter quiet
                            try {
                                const Quiz = require('../models/Quiz.models');
                                const quiz = await Quiz.findOne({ moduleId: module._id, sectionPath });
                                if (quiz) {
                                    const qAttempt = {
                                        userId,
                                        score: normalizedScore,
                                        totalQuestions: normalizedTotal,
                                        correctAnswers: normalizedScore,
                                        difficulty: progress.difficulty || 'beginner',
                                        completedAt: new Date()
                                    };
                                    quiz.attempts = quiz.attempts || [];
                                    quiz.attempts.push(qAttempt);
                                    await quiz.save();
                                }
                            } catch (innerErr) {
                                console.warn('Could not persist quiz attempt to Quiz model:', innerErr && innerErr.message);
                            }
                        }
                    }
                }
            } catch (err) {
                console.warn('Side-effect attempt save failed:', err && err.message);
            }

            // Award total points (speed bonus only; base points were already awarded per correct answer)
            let earnedPoints = 0;
            let unlockedGames = [];
            try {
                console.log(`[Points] Attempting to award points for user ${userId}, score: ${normalizedScore}/${normalizedTotal}, timeMs: ${timeMs}`);
                
                if (normalizedScore > 0 && normalizedTotal > 0) {
                    const User = require('../models/User.models');
                    const { ensureUserFields } = require('../utils/userHelpers');
                    const user = await User.findById(userId);
                    if (user) {
                        await ensureUserFields(user);
                        
                        // Speed bonus (if time data available)
                        let speedBonus = 0;
                        if (typeof timeMs === 'number' && timeMs > 0) {
                            const avgTimePerQ = (timeMs / normalizedTotal) / 1000; // Convert to seconds
                            const speedBonusPerQ = Math.max(0, Math.floor((15 - avgTimePerQ) / 1));
                            speedBonus = Math.max(0, Math.min(10 * normalizedScore, speedBonusPerQ * normalizedScore));
                        }
                        
                        // IMPORTANT: Base points are already awarded per correct answer in /answer.
                        // To avoid double-counting, we only add the speed bonus here.
                        const totalEarned = speedBonus;
                        
                        if (totalEarned > 0) {
                            const oldPoints = typeof user.points === 'number' ? user.points : 0;
                            user.points = oldPoints + totalEarned;
                            user.markModified('points');
                            await user.save();
                            
                            // Verify save
                            const verifyUser = await User.findById(userId, { points: 1 }).lean();
                            if (verifyUser) {
                                earnedPoints = totalEarned;
                                console.log(`[Points] ✅ Speed bonus awarded: ${totalEarned} (bonus: ${speedBonus}). New total: ${verifyUser.points}`);
                            } else {
                                console.error('[Points] ❌ Failed to verify points save');
                            }
                        }
                        
                        // Check for game unlocks
                        const gamesConfig = require('../config/games.config');
                        const unlockCost = gamesConfig.unlockCost ?? 950;
                        const availableGames = gamesConfig.games || [];
                        const locked = availableGames.filter(g => !(user.unlockedGames || []).includes(g));
                        
                        while ((user.points || 0) >= unlockCost && locked.length > 0) {
                            const randomIndex = Math.floor(Math.random() * locked.length);
                            const gameToUnlock = locked[randomIndex];
                            user.unlockedGames = user.unlockedGames || [];
                            user.unlockedGames.push(gameToUnlock);
                            locked.splice(randomIndex, 1);
                            unlockedGames.push(gameToUnlock);
                        }
                        
                        if (unlockedGames.length > 0) {
                            user.markModified('unlockedGames');
                            await user.save();
                        }
                    }
                }
                
                req._earnedPoints = earnedPoints;
                req._unlockedNow = unlockedGames;
            } catch (err) {
                console.error('[Points] ❌ Failed to award speed bonus (handler error):', err);
                req._earnedPoints = 0;
                req._unlockedNow = [];
            }

            // Return a normalized progress shape (same as getProgress) to keep frontend handling consistent
            // Sort attempts (newest first) for response
            const attemptsSorted = (progress.attempts || []).slice().sort((a, b) => new Date(b.date) - new Date(a.date));

            const normalizedProgress = {
                difficulty: progress.difficulty || 'beginner',
                mastery: progress.mastery || 0,
                attempts: attemptsSorted,
                lastAttemptAt: progress.lastSeenAt,
                xp: progress.xp || 0,
                streak: progress.streak || 0
            };

            // Ensure attempts are included in the response
            const responseData = { 
                success: true, 
                promoted: correctAll, 
                progress: {
                    ...normalizedProgress,
                    attempts: attemptsSorted // Explicitly include attempts array
                }, 
                earned: req._earnedPoints || earnedPoints || 0,
                pointsEarned: req._earnedPoints || earnedPoints || 0, // Alias for frontend compatibility
                unlocked: req._unlockedNow || unlockedGames || [], 
                score: normalizedScore,
                totalQuestions: normalizedTotal,
                correctAnswers: normalizedScore, // Add correctAnswers for frontend
                wrongAnswers: Math.max(0, normalizedTotal - normalizedScore)
            };
            
            console.log(`[Attempt Complete] Response:`, {
                ...responseData,
                attemptsCount: responseData.progress.attempts?.length || 0
            });
            
            return res.json(responseData);
        } catch (error) {
            console.error('attemptComplete error:', error);
            return res.status(500).json({ success: false, error: error.message });
        }
    }

    // POST /api/quiz/attempts - NEW DEDICATED ENDPOINT: Always save attempt (idempotent + guaranteed write)
    async saveAttempt(req, res) {
        try {
            const userId = req.user?._id;
            if (!userId) {
                return res.status(401).json({ success: false, error: 'User not authenticated' });
            }

            const { 
                subsectionId, 
                difficulty, 
                score, 
                correctAnswers, 
                totalQuestions, 
                timeTakenSeconds,
                startedAt,
                attemptedQuestions 
            } = req.body;

            // Validate required fields
            if (!subsectionId) {
                return res.status(400).json({ success: false, error: 'subsectionId is required' });
            }
            if (!difficulty || !['beginner', 'intermediate', 'advanced'].includes(difficulty)) {
                return res.status(400).json({ success: false, error: 'Valid difficulty is required (beginner, intermediate, advanced)' });
            }
            if (typeof score !== 'number' || score < 0) {
                return res.status(400).json({ success: false, error: 'Valid score is required' });
            }
            if (typeof correctAnswers !== 'number' || correctAnswers < 0) {
                return res.status(400).json({ success: false, error: 'Valid correctAnswers is required' });
            }
            if (typeof totalQuestions !== 'number' || totalQuestions < 1) {
                return res.status(400).json({ success: false, error: 'Valid totalQuestions is required (min 1)' });
            }

            console.log(`[Save Attempt] Creating new attempt for user ${userId}, subsection ${subsectionId}:`, {
                difficulty,
                score,
                correctAnswers,
                totalQuestions,
                timeTakenSeconds: timeTakenSeconds || 0,
                attemptedQuestionsCount: Array.isArray(attemptedQuestions) ? attemptedQuestions.length : 0
            });

            // ALWAYS create a new attempt document (no skipping, no duplicate checks)
            const attempt = new QuizAttempt({
                userId,
                subsectionId,
                difficulty,
                score,
                correctAnswers,
                totalQuestions,
                timeTakenSeconds: typeof timeTakenSeconds === 'number' ? timeTakenSeconds : 0,
                startedAt: startedAt ? new Date(startedAt) : new Date(),
                completedAt: new Date(),
                attemptedQuestions: Array.isArray(attemptedQuestions) ? attemptedQuestions.slice(0, 200) : []
            });

            await attempt.save();

            console.log(`[Save Attempt] ✅ Successfully saved attempt ${attempt._id} for user ${userId}`);

            // Also update UserProgress for backward compatibility
            try {
                let progress = await UserProgress.findOne({ userId, subsectionId });
                if (!progress) {
                    progress = await UserProgress.create({ userId, subsectionId, difficulty, attempts: [] });
                }

                // Add to attempts array in UserProgress (for backward compatibility)
                const progressAttempt = {
                    date: new Date(),
                    difficulty,
                    score,
                    totalQuestions,
                    timeMs: timeTakenSeconds ? timeTakenSeconds * 1000 : null,
                    attemptedQuestions: Array.isArray(attemptedQuestions) ? attemptedQuestions.slice(0, 200) : []
                };

                progress.attempts = progress.attempts || [];
                progress.attempts.push(progressAttempt);
                if (progress.attempts.length > 50) {
                    progress.attempts = progress.attempts.slice(-50);
                }
                progress.markModified('attempts');
                progress.lastSeenAt = new Date();
                await progress.save();

                console.log(`[Save Attempt] ✅ Also updated UserProgress for backward compatibility`);
            } catch (progressError) {
                console.warn(`[Save Attempt] Warning: Failed to update UserProgress:`, progressError.message);
                // Don't fail the request if UserProgress update fails
            }

            return res.json({ 
                success: true, 
                attempt: {
                    _id: attempt._id,
                    userId: attempt.userId,
                    subsectionId: attempt.subsectionId,
                    difficulty: attempt.difficulty,
                    score: attempt.score,
                    correctAnswers: attempt.correctAnswers,
                    totalQuestions: attempt.totalQuestions,
                    timeTakenSeconds: attempt.timeTakenSeconds,
                    startedAt: attempt.startedAt,
                    completedAt: attempt.completedAt
                }
            });
        } catch (error) {
            console.error('[Save Attempt] ❌ Error:', error);
            return res.status(500).json({ success: false, error: error.message });
        }
    }
}

module.exports = new QuizController();

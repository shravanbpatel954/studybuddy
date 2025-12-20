const mongoose = require('mongoose');

const missionProgressSchema = new mongoose.Schema({
    completedSteps: { type: Number, default: 0 },
    totalSteps: { type: Number, required: true },
    lastUpdated: Date
}, { _id: false });

const missionSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type: {
        type: String,
        enum: ['DAILY', 'WEEKLY', 'ACHIEVEMENT', 'SPECIAL'],
        required: true
    },
    category: {
        type: String,
        enum: ['STREAK', 'MASTERY', 'COMBO', 'POWER_UP', 'SKILL', 'COMPLETION'],
        required: true
    },
    title: { type: String, required: true },
    description: { type: String, required: true },
    reward: {
        xp: Number,
        skillPoints: Number,
        powerUps: [{
            type: String,
            enum: ['HINT', 'TIME_SLOW', 'SHIELD', 'DOUBLE_XP']
        }]
    },
    requirements: {
        targetValue: Number,  // e.g., reach 5 combo, complete 10 questions
        timeFrame: Number,    // in milliseconds, for daily/weekly missions
        difficulty: String,   // optional difficulty requirement
        topic: String        // optional topic requirement
    },
    progress: missionProgressSchema,
    status: {
        type: String,
        enum: ['ACTIVE', 'COMPLETED', 'EXPIRED', 'CLAIMED'],
        default: 'ACTIVE'
    },
    expiresAt: Date,
    completedAt: Date
}, {
    timestamps: true
});

// Index for efficient queries
missionSchema.index({ userId: 1, status: 1, type: 1 });
missionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Virtual for progress percentage
missionSchema.virtual('progressPercentage').get(function() {
    if (!this.progress) return 0;
    return Math.min(100, (this.progress.completedSteps / this.progress.totalSteps) * 100);
});

// Instance method to update progress
missionSchema.methods.updateProgress = async function(increment = 1) {
    if (this.status !== 'ACTIVE') return false;
    
    this.progress.completedSteps = Math.min(
        this.progress.totalSteps,
        (this.progress.completedSteps || 0) + increment
    );
    
    this.progress.lastUpdated = new Date();
    
    if (this.progress.completedSteps >= this.progress.totalSteps) {
        this.status = 'COMPLETED';
        this.completedAt = new Date();
    }
    
    await this.save();
    return this.status === 'COMPLETED';
};

// Static method to generate daily missions
missionSchema.statics.generateDailyMissions = async function(userId) {
    const missions = [
        {
            type: 'DAILY',
            category: 'STREAK',
            title: 'Daily Learning Streak',
            description: 'Complete 5 challenges today',
            reward: { xp: 100, skillPoints: 1 },
            requirements: {
                targetValue: 5,
                timeFrame: 86400000 // 24 hours
            },
            progress: { completedSteps: 0, totalSteps: 5 },
            expiresAt: new Date(Date.now() + 86400000)
        },
        {
            type: 'DAILY',
            category: 'COMBO',
            title: 'Combo Master',
            description: 'Achieve a 5x combo streak',
            reward: { xp: 150, powerUps: ['DOUBLE_XP'] },
            requirements: {
                targetValue: 5,
                timeFrame: 86400000
            },
            progress: { completedSteps: 0, totalSteps: 1 },
            expiresAt: new Date(Date.now() + 86400000)
        },
        {
            type: 'DAILY',
            category: 'MASTERY',
            title: 'Perfect Score',
            description: 'Get 3 perfect answers in advanced difficulty',
            reward: { xp: 200, skillPoints: 2 },
            requirements: {
                targetValue: 3,
                difficulty: 'advanced',
                timeFrame: 86400000
            },
            progress: { completedSteps: 0, totalSteps: 3 },
            expiresAt: new Date(Date.now() + 86400000)
        }
    ];

    return await this.insertMany(
        missions.map(mission => ({ ...mission, userId }))
    );
};

module.exports = mongoose.model('GameMission', missionSchema);
const mongoose = require('mongoose');

const quizSessionSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    subsectionId: { type: mongoose.Schema.Types.ObjectId, required: true },
    startTime: { type: Date, default: Date.now },
    endTime: { type: Date },
    difficulty: { type: String, enum: ['beginner', 'intermediate', 'advanced', 'expert'] },
    totalQuestions: { type: Number },
    correctAnswers: { type: Number },
    timeSpentMs: { type: Number },
    questions: [{
        questionId: mongoose.Schema.Types.Mixed,
        question: String,
        options: [String],
        correctAnswer: String,
        selectedAnswer: String,
        timeSpentMs: Number,
        isCorrect: Boolean,
        explanation: String,
        topic: String
    }],
    mastery: {
        before: Number,
        after: Number,
        gain: Number
    },
    xp: {
        earned: Number,
        bonus: Number,
        total: Number
    },
    streak: {
        before: Number,
        after: Number
    },
    rewards: {
        badges: [{
            name: String,
            icon: String,
            description: String
        }],
        unlocks: [{
            type: String,
            name: String,
            description: String
        }]
    }
}, { timestamps: true });

// Add index for quick lookups
quizSessionSchema.index({ userId: 1, subsectionId: 1, createdAt: -1 });

module.exports = mongoose.model('QuizSession', quizSessionSchema);
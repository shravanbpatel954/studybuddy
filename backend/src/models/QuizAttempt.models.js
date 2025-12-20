const mongoose = require('mongoose');

const quizAttemptSchema = new mongoose.Schema({
    userId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User', 
        required: true,
        index: true
    },
    subsectionId: { 
        type: mongoose.Schema.Types.ObjectId, 
        required: true,
        index: true
    },
    difficulty: { 
        type: String, 
        enum: ['beginner', 'intermediate', 'advanced'], 
        required: true 
    },
    score: { 
        type: Number, 
        required: true,
        min: 0
    },
    correctAnswers: { 
        type: Number, 
        required: true,
        min: 0
    },
    totalQuestions: { 
        type: Number, 
        required: true,
        min: 1
    },
    timeTakenSeconds: { 
        type: Number, 
        default: 0,
        min: 0
    },
    startedAt: { 
        type: Date, 
        default: Date.now 
    },
    completedAt: { 
        type: Date, 
        default: Date.now 
    },
    attemptedQuestions: [{
        questionId: mongoose.Schema.Types.Mixed,
        question: String,
        options: [String],
        correctAnswer: String,
        selectedAnswer: String,
        timeMs: Number
    }]
}, { 
    timestamps: true 
});

// Compound index for efficient queries
quizAttemptSchema.index({ userId: 1, subsectionId: 1 });
quizAttemptSchema.index({ userId: 1, subsectionId: 1, completedAt: -1 });

module.exports = mongoose.model('QuizAttempt', quizAttemptSchema);

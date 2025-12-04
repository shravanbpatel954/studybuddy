const mongoose = require('mongoose');

const QuizQuestionSchema = new mongoose.Schema({
    question: {
        type: String,
        required: true
    },
    options: [{
        type: String,
        required: true
    }],
    correctAnswer: {
        type: String,
        required: true
    },
    difficulty: {
        type: String,
        enum: ['beginner', 'intermediate', 'advanced'],
        default: 'beginner'
    },
    type: {
        type: String,
        enum: ['mcq', 'true-false', 'fill-in'],
        default: 'mcq'
    }
});

const QuizAttemptSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    score: {
        type: Number,
        required: true
    },
    totalQuestions: {
        type: Number,
        required: true
    },
    correctAnswers: {
        type: Number,
        required: true
    },
    difficulty: {
        type: String,
        enum: ['beginner', 'intermediate', 'advanced'],
        required: true
    },
    completedAt: {
        type: Date,
        default: Date.now
    }
});

const QuizSchema = new mongoose.Schema({
    moduleId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Module',
        required: true
    },
    sectionPath: {
        type: String,
        required: true,
        // Format: "chapterId.sectionId.subsectionId" e.g. "1.2.1"
    },
    questions: [QuizQuestionSchema],
    attempts: [QuizAttemptSchema],
    currentDifficulty: {
        type: String,
        enum: ['beginner', 'intermediate', 'advanced'],
        default: 'beginner'
    },
    lastGenerated: {
        type: Date,
        default: Date.now
    }
}, { timestamps: true });

// Index for efficient lookups
QuizSchema.index({ moduleId: 1, sectionPath: 1 });

// Method to determine if new questions needed
QuizSchema.methods.needsNewQuestions = function(difficulty) {
    // Generate new questions if:
    // 1. No questions exist for current difficulty
    // 2. Questions are older than 30 days
    // 3. All questions have been used multiple times
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    return !this.questions.length || 
           this.lastGenerated < thirtyDaysAgo ||
           this.currentDifficulty !== difficulty;
};

// Method to update difficulty based on performance
QuizSchema.methods.updateDifficulty = function(attempt) {
    const successRate = attempt.correctAnswers / attempt.totalQuestions;
    
    if (this.currentDifficulty === 'beginner' && successRate > 0.8) {
        this.currentDifficulty = 'intermediate';
    } else if (this.currentDifficulty === 'intermediate') {
        if (successRate > 0.8) {
            this.currentDifficulty = 'advanced';
        } else if (successRate < 0.4) {
            this.currentDifficulty = 'beginner';
        }
    } else if (this.currentDifficulty === 'advanced' && successRate < 0.4) {
        this.currentDifficulty = 'intermediate';
    }
};

const Quiz = mongoose.model('Quiz', QuizSchema);
module.exports = Quiz;
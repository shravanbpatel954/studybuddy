const mongoose = require('mongoose');

const UserQuizSchema = new mongoose.Schema({
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
        required: true,
        default: 'beginner'
    },
    questions: [{
        question: { type: String, required: true },
        options: [{ type: String, required: true }],
        correctAnswer: { type: String, required: true },
        explanation: { type: String },
        topic: { type: String },
        resources: {
            youtube: [String],
            articles: [String],
            additionalTopics: [String]
        }
    }],
    currentIndex: {
        type: Number,
        default: 0
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
}, { timestamps: true });

// Compound index for efficient lookups: one quiz per user/subsection/difficulty
UserQuizSchema.index({ userId: 1, subsectionId: 1, difficulty: 1 }, { unique: true });

// Method to get next question
UserQuizSchema.methods.getNextQuestion = function() {
    if (this.currentIndex >= this.questions.length) {
        return null; // Quiz completed
    }
    return this.questions[this.currentIndex];
};

// Method to advance to next question
UserQuizSchema.methods.advance = function() {
    if (this.currentIndex < this.questions.length) {
        this.currentIndex += 1;
        this.updatedAt = new Date();
        return true;
    }
    return false;
};

// Method to reset quiz
UserQuizSchema.methods.reset = function() {
    this.currentIndex = 0;
    this.updatedAt = new Date();
};

const UserQuiz = mongoose.model('UserQuiz', UserQuizSchema);
module.exports = UserQuiz;


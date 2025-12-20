const mongoose = require('mongoose');

const flashcardScheduleSchema = new mongoose.Schema({
    flashcardId: mongoose.Schema.Types.Mixed,
    nextReviewAt: Date,
    intervalSecs: Number,
    easeFactor: Number
}, { _id: false });

const userProgressSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    subsectionId: { type: mongoose.Schema.Types.ObjectId, required: true },
    mastery: { type: Number, default: 0 },
    difficulty: { type: String, enum: ['beginner', 'intermediate', 'advanced'], default: 'intermediate' },
    consecutiveCorrect: { type: Number, default: 0 },
    consecutiveWrong: { type: Number, default: 0 },
    xp: { type: Number, default: 0 },
    streak: { type: Number, default: 0 },
    flashcardSchedule: [flashcardScheduleSchema],
    lastSeenAt: Date
    ,
    attempts: [{
        date: { type: Date, default: Date.now },
        difficulty: { type: String, enum: ['beginner', 'intermediate', 'advanced'] },
        score: Number,
        totalQuestions: Number,
        timeMs: Number
        ,
        attemptedQuestions: [{
            questionId: mongoose.Schema.Types.Mixed,
            question: String,
            options: [String],
            correctAnswer: String,
            selectedAnswer: String,
            timeMs: Number
        }]
    }]
}, { timestamps: true });

module.exports = mongoose.model('UserProgress', userProgressSchema);

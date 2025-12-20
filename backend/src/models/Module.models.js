const mongoose = require('mongoose');

const quizQuestionSchema = new mongoose.Schema({
    question: String,
    type: {
        type: String,
        enum: ['mcq', 'true-false', 'short-answer'],
        default: 'mcq'
    },
    options: [String],
    correctAnswer: String,
    explanation: String,
    topic: String,
    resources: {
        youtube: [String],
        articles: [String],
        additionalTopics: [String]
    },
    attempts: [{
        userId: mongoose.Schema.Types.ObjectId,
        selectedAnswer: String,
        correct: Boolean,
        timeMs: Number,
        date: { type: Date, default: Date.now }
    }],
    difficulty: {
        type: String,
        enum: ['beginner', 'intermediate', 'advanced', 'expert'],
        default: 'intermediate'
    }
});

const flashcardSchema = new mongoose.Schema({
    front: String,
    back: String,
    tags: [String],
    lastReviewed: Date,
    reviewCount: {
        type: Number,
        default: 0
    }
});

const learningMaterialSchema = new mongoose.Schema({
    type: {
        type: String,
        enum: ['pdf', 'doc', 'ppt', 'image', 'notes', 'link'],
        required: true
    },
    title: String,
    description: String,
    file: {
        path: String,
        originalName: String,
        mimeType: String,
        size: Number
    },
    content: String,  // For text content or links
    uploadedAt: {
        type: Date,
        default: Date.now
    },
    isUserGenerated: {
        type: Boolean,
        default: true
    }
});

const subsectionSchema = new mongoose.Schema({
    id: String,
    name: String,
    type: {
        type: String,
        enum: ['concept', 'definition', 'example', 'application'],
        default: 'concept'
    },
    content: {
        description: String,
        key_points: [String],
        examples: [String],
        resources: {
            youtube: [String],
            articles: [String],
            additionalTopics: [String]
        },
        difficulty: {
            type: String,
            enum: ['beginner', 'intermediate', 'advanced'],
            default: 'intermediate'
        }
    },
    difficultyLevel: {
        type: String,
        enum: ['beginner', 'intermediate', 'advanced'],
        default: 'beginner'
    },
    learningMaterials: [learningMaterialSchema],
    quizzes: [quizQuestionSchema],
    flashcards: [flashcardSchema],
    userProgress: {
        quizAttempts: [{
            date: Date,
            score: Number,
            totalQuestions: Number
        }],
        flashcardProgress: {
            mastered: Number,
            learning: Number,
            new: Number
        },
        lastAccessed: Date
    }
});

const sectionSchema = new mongoose.Schema({
    id: String,
    name: String,
    difficulty: {
        type: String,
        enum: ['beginner', 'intermediate', 'advanced'],
        default: 'intermediate'
    },
    difficultyLevel: {
        type: String,
        enum: ['beginner', 'intermediate', 'advanced'],
        default: 'beginner'
    },
    subsections: [subsectionSchema]
});

const moduleSchema = new mongoose.Schema({
    subject: {
        type: String,
        required: true
    },
    chapters: [{
        id: String,
        name: String,
        difficulty: {
            type: String,
            enum: ['beginner', 'intermediate', 'advanced'],
            default: 'intermediate'
        },
        difficultyLevel: {
            type: String,
            enum: ['beginner', 'intermediate', 'advanced'],
            default: 'beginner'
        },
        sections: [sectionSchema]
    }],
    owner: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    members: [{
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        role: {
            type: String,
            enum: ['owner', 'admin', 'member'],
            default: 'member'
        }
    }],
    progress: {
        type: Number,
        default: 0
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    shareCode: {
        type: String,
        unique: true,
        sparse: true
    },
    originalModule: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Module'
    },
    isShared: {
        type: Boolean,
        default: false
    }
});

module.exports = mongoose.model('Module', moduleSchema);
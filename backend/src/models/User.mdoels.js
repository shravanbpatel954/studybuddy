const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const Schema = new mongoose.Schema({
        // Google OAuth fields
        node_id: String,
        displayName: String,
        photo: String,
        email: {
            type: String,
            required: true,
            unique: true
        },
        // Email/Password fields
        password: String,
        // Allow multiple auth methods for the same account
        authMethod: {
            type: [String],
            enum: ['google', 'email'],
            required: true,
            default: ['email']
        },
        // Password reset fields
        resetPasswordToken: String,
        resetPasswordExpires: Date,
        // Reward system
        points: {
            type: Number,
            default: 0,
            required: true,
            min: 0
        },
        // Names of unlocked games (match client game names)
        unlockedGames: {
            type: [String],
            default: ['Basket Hoop']
        },
        // Game time tracking (10 minutes per hour restriction)
        lastGamePlayTime: {
            type: Date,
            default: null
        },
        gameTimeUsedToday: {
            type: Number,
            default: 0 // in milliseconds
        },
        // Track when the current hour window started (for reset logic)
        gameTimeWindowStart: {
            type: Date,
            default: null
        }
},{timestamps:true})

// Hash password before saving
Schema.pre('save', async function(next) {
    if (this.isModified('password') && this.password) {
        this.password = await bcrypt.hash(this.password, 12);
    }
    next();
});

// Compare password method
Schema.methods.comparePassword = async function(candidatePassword) {
    if (!this.password) return false;
    return await bcrypt.compare(candidatePassword, this.password);
};

// Register model as 'User' (capitalized) to match refs elsewhere (e.g. Message.sender ref: 'User')
const UserModel = mongoose.model("User", Schema);

module.exports = UserModel;
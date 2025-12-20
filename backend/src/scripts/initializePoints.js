/**
 * Migration script to initialize points field for all existing users
 * Run this once to ensure all users have the points field in the database
 * 
 * Usage: node backend/src/scripts/initializePoints.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const mongoose = require('mongoose');
const User = require('../models/User.models');

async function initializePoints() {
    try {
        // Connect to MongoDB
        let mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
        if (!mongoUri) {
            console.error('MONGO_URI not found in environment variables');
            process.exit(1);
        }

        // Ensure the database name is 'studybuddy'
        try {
            const url = new URL(mongoUri);
            if (!url.pathname || url.pathname === '/' || url.pathname !== '/studybuddy') {
                url.pathname = '/studybuddy';
                mongoUri = url.toString();
                console.log(`Updated database name to 'studybuddy' in connection string`);
            }
        } catch (e) {
            // For mongodb+srv:// or mongodb:// format
            if (mongoUri.includes('mongodb+srv://') || mongoUri.includes('mongodb://')) {
                const parts = mongoUri.split('/');
                if (parts.length >= 4) {
                    parts[parts.length - 1] = 'studybuddy';
                    mongoUri = parts.join('/');
                    console.log(`Updated database name to 'studybuddy' in connection string`);
                } else if (parts.length === 3) {
                    mongoUri = mongoUri + '/studybuddy';
                    console.log(`Added database name 'studybuddy' to connection string`);
                }
            }
        }

        await mongoose.connect(mongoUri);
        console.log('Connected to MongoDB');
        console.log(`Database name: ${mongoose.connection.name}`);
        
        // Verify we're connected to the correct database
        if (mongoose.connection.name !== 'studybuddy') {
            console.error(`❌ ERROR: Connected to database '${mongoose.connection.name}' instead of 'studybuddy'`);
            console.error(`Please check your MONGO_URI/MONGODB_URI environment variable`);
            await mongoose.disconnect();
            process.exit(1);
        } else {
            console.log(`✓ Connected to 'studybuddy' database`);
        }

        // Find all users
        const users = await User.find({});
        console.log(`Found ${users.length} users`);

        let updated = 0;
        let alreadyHasPoints = 0;

        for (const user of users) {
            let needsSave = false;
            
            // Check if points field is missing or invalid
            if (typeof user.points !== 'number' || isNaN(user.points)) {
                user.points = 0;
                user.markModified('points');
                needsSave = true;
            }
            
            // Check if unlockedGames field is missing or invalid
            if (!Array.isArray(user.unlockedGames) || user.unlockedGames.length === 0) {
                user.unlockedGames = ['Basket Hoop'];
                user.markModified('unlockedGames');
                needsSave = true;
            }
            
            if (needsSave) {
                await user.save();
                updated++;
                console.log(`✓ Initialized points/unlockedGames for user: ${user.email || user._id}`);
            } else {
                alreadyHasPoints++;
            }
        }

        console.log('\n=== Migration Summary ===');
        console.log(`Total users: ${users.length}`);
        console.log(`Updated (points initialized): ${updated}`);
        console.log(`Already had points: ${alreadyHasPoints}`);

        await mongoose.disconnect();
        console.log('\nMigration completed successfully!');
        process.exit(0);
    } catch (error) {
        console.error('Migration error:', error);
        await mongoose.disconnect();
        process.exit(1);
    }
}

// Run the migration
initializePoints();


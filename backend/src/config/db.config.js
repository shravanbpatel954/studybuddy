const { default: mongoose } = require("mongoose");

exports.ConnectDB = async () => {
  try {
    console.log("Connecting to database...");
    
    let mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
    if (!mongoUri) {
      console.error("MONGODB_URI not found in environment variables");
      process.exit(1);
    }
    
    // Ensure the database name is 'studybuddy'
    // Parse the URI and replace the database name if needed
    try {
      const url = new URL(mongoUri);
      // If the pathname is empty or not 'studybuddy', update it
      if (!url.pathname || url.pathname === '/' || url.pathname !== '/studybuddy') {
        url.pathname = '/studybuddy';
        mongoUri = url.toString();
        console.log(`Updated database name to 'studybuddy' in connection string`);
      }
    } catch (e) {
      // If it's not a standard URL format (might be mongodb+srv://), try to parse it differently
      // For mongodb+srv:// format, the database name is after the last /
      if (mongoUri.includes('mongodb+srv://')) {
        const parts = mongoUri.split('/');
        if (parts.length >= 4) {
          // Replace the last part (database name) with 'studybuddy'
          parts[parts.length - 1] = 'studybuddy';
          mongoUri = parts.join('/');
          console.log(`Updated database name to 'studybuddy' in connection string`);
        } else if (parts.length === 3) {
          // No database name specified, add it
          mongoUri = mongoUri + '/studybuddy';
          console.log(`Added database name 'studybuddy' to connection string`);
        }
      } else if (mongoUri.includes('mongodb://')) {
        const parts = mongoUri.split('/');
        if (parts.length >= 4) {
          // Replace the last part (database name) with 'studybuddy'
          parts[parts.length - 1] = 'studybuddy';
          mongoUri = parts.join('/');
          console.log(`Updated database name to 'studybuddy' in connection string`);
        } else if (parts.length === 3) {
          // No database name specified, add it
          mongoUri = mongoUri + '/studybuddy';
          console.log(`Added database name 'studybuddy' to connection string`);
        }
      }
    }
    
    await mongoose.connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 10000, // 10s
    });
    
    console.log(`DB connected with host ${mongoose.connection.host}`);
    console.log(`Database name: ${mongoose.connection.name}`);
    
    // Verify we're connected to the correct database
    if (mongoose.connection.name !== 'studybuddy') {
      console.warn(`⚠️  WARNING: Connected to database '${mongoose.connection.name}' instead of 'studybuddy'`);
      console.warn(`Please check your MONGODB_URI environment variable`);
    } else {
      console.log(`✓ Connected to 'studybuddy' database`);
    }
  } catch (error) {
    console.error("Database connection error:", error.message);
    process.exit(1); // Exit app if DB connection fails
  }
};

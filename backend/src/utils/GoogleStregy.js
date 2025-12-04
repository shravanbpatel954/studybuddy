const { LoginWithGoogle } = require('../controller/AuthController');

const GoogleStrategy = require('passport-google-oauth20').Strategy;

// Get base URL from environment or default to localhost for development
const getBaseURL = () => {
  if (process.env.BACKEND_URL) {
    return process.env.BACKEND_URL;
  }
  const port = process.env.PORT || 8080;
  return `http://localhost:${port}`;
};

exports.GoogleProvider  = new GoogleStrategy({
     clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: `${getBaseURL()}/api/v1/auth/google/callback`
},async function(access,refresh,profile,cb){
  await  LoginWithGoogle(profile,cb)
})

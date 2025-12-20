const passport = require("passport");

// Serialize user
passport.serializeUser(function (user, done) {
  done(null, user);
});

// Deserialize user
passport.deserializeUser(function (user, done) {
  done(null, user);
});

module.exports = passport;

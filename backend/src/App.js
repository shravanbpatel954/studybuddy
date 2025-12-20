const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const passport = require("./utils/passport"); // ✅ FIXED IMPORT
const session = require("express-session");
const errorHandler = require("./middleware/errorHandler");

const app = express();

// ✅ BASIC MIDDLEWARE
app.use(cors());
app.use(morgan("dev"));

app.use(session({
  secret: process.env.SESSION_SECRET || "fallback_secret",
  resave: false,
  saveUninitialized: false,
}));

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// ✅ PASSPORT INITIALIZATION (SAFE)
if (passport && typeof passport.initialize === "function") {
  app.use(passport.initialize());
  app.use(passport.session());
  console.log("✅ Passport initialized successfully");
} else {
  console.error("❌ Passport failed to initialize. Check utils/passport.js export.");
}

// ✅ LOAD GOOGLE STRATEGY SAFELY
let GoogleProvider = null;

try {
  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    const googleStrategyModule = require("./utils/GoogleStregy");

    if (googleStrategyModule?.GoogleProvider) {
      GoogleProvider = googleStrategyModule.GoogleProvider;
      passport.use(GoogleProvider);
      console.log("✅ Google OAuth strategy configured");
    } else {
      console.log("⚠️ Google strategy file loaded but provider missing");
    }
  } else {
    console.log("⚠️ Google OAuth ENV variables missing — skipping Google strategy");
  }
} catch (err) {
  console.log("❌ Google OAuth strategy not available:", err.message);
}

// ✅ ROUTES (SAFE ORDER)
app.use("/api/v1/auth", require("./router/index.router"));
app.use("/api/v1/auth/modules", require("./router/module.router"));

app.use("/api/leaderboard", require("./router/leaderboard.router"));
app.use("/api/user", require("./router/user.router"));
app.use("/api/points", require("./router/points.router"));
app.use("/api/test", require("./router/test.router"));

app.use("/api/v1/ai", require("./router/ai.router"));
app.use("/api/v1/qpp", require("./router/qpp.router"));
app.use("/api/v1/game", require("./router/game.router"));
// Quiz routes (videos/shorts/quiz endpoints)
const quizRouter = require("./router/quiz.router");
app.use("/api/quiz", quizRouter);
// Backward-compatibility alias for older frontend paths
app.use("/api/v1/auth/quiz", quizRouter);

// Video recommendation routes (smart YouTube video recommendation)
const videoRouter = require("./router/videoRoutes");
app.use("/api/videos", videoRouter);
console.log("Video recommendation routes mounted at /api/videos");

// ✅ ROOT ROUTE
app.get("/", (req, res) => {
  res.json({ message: "StudyBuddy API Running ✅" });
});

// ✅ ERROR HANDLER
app.use(errorHandler);

// ✅ GLOBAL 404
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: "Route not found",
    path: req.originalUrl
  });
});

module.exports = app;

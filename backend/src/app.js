const express = require("express")
const cors = require("cors")
const morgan = require("morgan")
const { PasspORt } = require("./utils/passport")
const session = require("express-session")
const { GoogleProvider } = require("./utils/GoogleStregy")
//server
const app = express()

// middleware
// CORS configuration - allow specific origins in production
const corsOptions = {
  origin: process.env.NODE_ENV === 'production' 
    ? (process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : '*')
    : '*',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};
app.use(cors(corsOptions))
app.use(morgan("dev"))
app.use(session({
    secret: process.env.SESSION_SECRET || '#$%^&*($%^&*I',
    resave:false,
    saveUninitialized:false
}))
app.use(express.json())
app.use(express.urlencoded({extended:false}))
app.use(PasspORt.initialize())
app.use(PasspORt.session())

// streagy use karne ke liye
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    PasspORt.use(GoogleProvider)
} else {
    console.log("Google OAuth not configured - skipping Google strategy")
}

// Root auth router
app.use("/api/v1/auth", require("./router/index.router"));

// Module routes are mounted directly for better path handling
app.use("/api/v1/auth/modules", require("./router/module.router"));

// Expose leaderboard, user and points endpoints at top-level /api paths for frontend
app.use('/api/leaderboard', require('./router/leaderboard.router'));
app.use('/api/user', require('./router/user.router'));
app.use('/api/points', require('./router/points.router'));

// Mount test routes with more specific path
const testRouter = require('./router/test.router');
app.use('/api/test', testRouter);
console.log('Test routes mounted at /api/test');
// AI routes with separate Gemini API key for doubt solving
app.use("/api/v1/ai", require("./router/ai.router"));

// QPP (Question Paper Preparation) routes
const qppRouter = require("./router/qpp.router");
app.use("/api/v1/qpp", (req, res, next) => {
  console.log(`[App] QPP route hit: ${req.method} ${req.originalUrl}`);
  next();
}, qppRouter);
console.log('QPP routes mounted at /api/v1/qpp');
console.log('Available QPP routes:', [
  'POST /api/v1/qpp/generate',
  'POST /api/v1/qpp/download/pdf',
  'POST /api/v1/qpp/download/word',
  'GET /api/v1/qpp/test',
  'GET /api/v1/qpp/download/test',
  'POST /api/v1/qpp/download/test-post'
].join(', '));

// Game routes
const gameRouter = require("./router/game.router");
app.use("/api/v1/game", gameRouter);
console.log('Game routes mounted at /api/v1/game');
console.log('Available game routes:', [
  'GET /api/v1/game/missions',
  'POST /api/v1/game/missions/:id/claim',
  'POST /api/v1/game/progress/update',
  'POST /api/v1/game/score',
  'POST /api/v1/game/unlock',
  'GET /api/v1/game/time-status',
  'POST /api/v1/game/start',
  'POST /api/v1/game/end'
].join(', '));

// Root route
app.get("/", (req, res) => {
    res.json({
        message: "Mix Authentication API is running!",
        endpoints: {
            auth: "/api/v1/auth",
            google: "/api/v1/auth/google",
            register: "/api/v1/auth/register",
            login: "/api/v1/auth/login",
            profile: "/api/v1/auth/profile",
            qpp: "/api/v1/qpp"
        }
    });
});

// Global 404 handler (must be last)
app.use((req, res) => {
    console.log(`[App] 404 - Route not found: ${req.method} ${req.originalUrl}`);
    res.status(404).json({
        success: false,
        error: 'Route not found',
        method: req.method,
        path: req.originalUrl
    });
});

module.exports = app
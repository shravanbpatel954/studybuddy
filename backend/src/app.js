const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const { PasspORt } = require("./utils/passport");
const session = require("express-session");
const { GoogleProvider } = require("./utils/GoogleStregy");

const app = express();

/*  
===========================================
🔥 FIXED CORS — REQUIRED FOR Render Hosting
===========================================
*/
const allowedOrigins = [
    "http://localhost:3000",
    "http://localhost:5173",
    "https://studybuddy-kc2m.onrender.com",  // FRONTEND PRODUCTION
];

app.use(
    cors({
        origin: function (origin, callback) {
            if (!origin) return callback(null, true); // mobile apps, curl, postman

            if (allowedOrigins.includes(origin)) {
                return callback(null, true);
            }

            console.log("⛔ BLOCKED ORIGIN:", origin);
            return callback(new Error("CORS blocked"));
        },
        credentials: true,
        methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allowedHeaders: ["Content-Type", "Authorization"],
    })
);

// Preflight support
app.options("*", cors());

/* ====================================== */

app.use(morgan("dev"));
app.use(
    session({
        secret: process.env.SESSION_SECRET || "#$%^&*($%^&*I",
        resave: false,
        saveUninitialized: false,
    })
);

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: false, limit: "50mb" }));

app.use(PasspORt.initialize());
app.use(PasspORt.session());

// Google Strategy
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    PasspORt.use(GoogleProvider);
} else {
    console.log("Google OAuth not configured - skipping Google strategy");
}

/* =======================
   ROUTES
======================= */

// Auth
app.use("/api/v1", require("./router/index.router"));


// Modules
app.use("/api/v1/auth/modules", require("./router/module.router"));

// Leaderboard, user, points
app.use("/api/leaderboard", require("./router/leaderboard.router"));
app.use("/api/user", require("./router/user.router"));
app.use("/api/points", require("./router/points.router"));

// Test
app.use("/api/test", require("./router/test.router"));

// AI Routes
app.use("/api/v1/ai", require("./router/ai.router"));

// QPP
app.use("/api/v1/qpp", require("./router/qpp.router"));

// Game routes
app.use("/api/v1/game", require("./router/game.router"));

// Root
app.get("/", (req, res) => {
    res.json({
        message: "StudyBuddy API Running",
        endpoints: {
            auth: "/api/v1/auth",
            qpp: "/api/v1/qpp",
        },
    });
});

// Global 404
app.use((req, res) => {
    console.log(`[404] Route not found → ${req.method} ${req.originalUrl}`);
    res.status(404).json({
        success: false,
        error: "Route not found",
        path: req.originalUrl,
    });
});

module.exports = app;

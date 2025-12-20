const express = require("express");
const router = express.Router();
const passport = require("../utils/passport"); // ✅ FIXED
const {
  VerifyToken,
  ProfileController,
  Register,
  Login,
  ForgotPassword,
  ResetPassword,
  UpdateProfile,
  DebugProfile
} = require("../controller/AuthController");

const moduleRouter = require("./module.router");
const quizRouter = require("./quiz.router");
const leaderboardRouter = require("./leaderboard.router");
const userRouter = require("./user.router");
const qppRouter = require("./qpp.router");

const { validateEmail, validatePassword, sanitizeInput } = require("../middleware/validation");
const { authLimiter, passwordResetLimiter } = require("../middleware/rateLimiter");

// ✅ GOOGLE LOGIN
router.get("/google", (req, res, next) => {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    return res.status(400).json({
      error: "Google OAuth not configured"
    });
  }

  passport.authenticate("google", {
    scope: ["profile", "email"]
  })(req, res, next);
});

// ✅ URL HELPERS
const getBackendURL = () => {
  const port = process.env.PORT || 8080;
  return process.env.BACKEND_URL || `http://localhost:${port}`;
};

const getFrontendURL = () => {
  return process.env.FRONTEND_URL || "http://localhost:3000";
};

// ✅ GOOGLE CALLBACK
router.get(
  "/google/callback",
  passport.authenticate("google", {
    failureRedirect: `${getBackendURL()}/api/v1/auth/failed`
  }),
  async (req, res) => {
    try {
      const user = req.user;

      req.logout(() => {
        console.log("✅ Logout success");
      });

      res.redirect(`${getFrontendURL()}/success?token=${user}`);
    } catch (error) {
      console.error("Google callback error:", error);
      res.redirect(`${getBackendURL()}/api/v1/auth/failed`);
    }
  }
);

// ✅ DASHBOARD
router.get("/dashboard", async (req, res) => {
  if (!req.isAuthenticated || !req.isAuthenticated()) {
    return res.send("You are not logged in");
  }

  res.send("<h1>This is Dashboard</h1>");
});

router.get("/failed", (req, res) => {
  res.send("Failed to login with Google");
});

router.get("/success", (req, res) => {
  res.send({ token: req.query?.token });
});

// ✅ PROFILE ROUTES
router.get("/profile", VerifyToken, ProfileController);
router.patch("/profile", VerifyToken, UpdateProfile);
router.get("/profile/debug", VerifyToken, DebugProfile);

// ✅ AUTH ROUTES
router.post(
  "/register",
  authLimiter,
  sanitizeInput,
  validateEmail,
  validatePassword,
  Register
);

router.post(
  "/login",
  authLimiter,
  sanitizeInput,
  validateEmail,
  Login
);

// ✅ PASSWORD RESET
router.post(
  "/forgot",
  passwordResetLimiter,
  sanitizeInput,
  validateEmail,
  ForgotPassword
);

router.post(
  "/reset",
  passwordResetLimiter,
  sanitizeInput,
  validatePassword,
  ResetPassword
);

// ✅ LOGOUT
router.post("/logout", async (req, res) => {
  res.status(200).json({
    message: "Logout successful"
  });
});

// ✅ SUB-ROUTES
router.use("/modules", moduleRouter);
router.use("/quiz", quizRouter);
router.use("/leaderboard", leaderboardRouter);
router.use("/user", userRouter);
router.use("/chat", require("./chat.router"));
router.use("/qpp", qppRouter);

module.exports = router;

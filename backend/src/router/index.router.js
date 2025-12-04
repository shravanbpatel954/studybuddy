const express = require("express")
const router = express.Router()
const passport = require("../utils/passport")
const { VerifyToken, ProfileController, Register, Login, ForgotPassword, ResetPassword } = require("../controller/AuthController")
const moduleRouter = require('./module.router')
const quizRouter = require('./quiz.router')
const leaderboardRouter = require('./leaderboard.router')
const userRouter = require('./user.router')

router.route("/google")
.get((req, res) => {
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
        return res.status(400).json({
            error: "Google OAuth not configured. Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET environment variables."
        });
    }
    passport.PasspORt.authenticate("google",{scope:['profile','email']})(req, res);
})


// Get URLs from environment variables
const getBackendURL = () => {
  if (process.env.BACKEND_URL) {
    return process.env.BACKEND_URL;
  }
  const port = process.env.PORT || 8080;
  return `http://localhost:${port}`;
};

const getFrontendURL = () => {
  // Simply use FRONTEND_URL from .env file
  // For local development, set FRONTEND_URL=http://localhost:3000 in backend/.env
  // For production, set FRONTEND_URL=https://your-production-url.com in backend/.env
  return process.env.FRONTEND_URL || 'http://localhost:3000';
};

router.route("/google/callback")
.get(passport.PasspORt.authenticate("google",{failureRedirect:`${getBackendURL()}/api/v1/auth/failed`}),async(req,res)=>{
    try {
        const user = await req.user
        await req.logout(()=>{
            console.log("Logout success")
        })

        res.redirect(`${getFrontendURL()}/success?token=${user}`)
    } catch (error) {
        console.error("Google callback error:", error)
        res.redirect(`${getBackendURL()}/api/v1/auth/failed`)
    }
})


router.route("/dashboard")
.get(async(req,res)=>{
        if(!req.isAuthenticated()){
            return  res.send("can not access by you b/c you are not logged in")
        }

   return res.send("<h1>This is Dashboard</h1>")
})

router.route("/failed")
.get(function(req,res){
    res.send("Failed to login with google")
})

router.route("/success")
.get(function(req,res){
    res.send({token:req.query?.token})
})



router.route("/profile")
.get(VerifyToken,ProfileController)
.patch(VerifyToken, require('../controller/AuthController').UpdateProfile)

// Debug route to inspect token payload and DB user
router.route('/profile/debug')
    .get(VerifyToken, require('../controller/AuthController').DebugProfile)

// Email/Password Authentication Routes
router.route("/register")
.post(Register)

router.route("/login")
.post(Login)

// Password reset endpoints
router.route('/forgot')
.post(ForgotPassword)

router.route('/reset')
.post(ResetPassword)

// Logout route
router.route("/logout")
.post(async(req,res)=>{
    try {
        // Since we're using JWT, we don't need server-side logout
        // Just return success - client will remove token
        res.status(200).json({
            message: "Logout successful"
        })
    } catch (error) {
        res.status(500).json({
            error: "Logout failed"
        })
    }
})


// Add module routes
// Add module routes
router.use('/modules', moduleRouter);
// Add quiz routes
router.use('/quiz', quizRouter);
// Add leaderboard routes
router.use('/leaderboard', leaderboardRouter);
// Add user helper routes
router.use('/user', userRouter);
// Note: Game routes are mounted directly in app.js at /api/v1/game
// Add chat routes
router.use('/chat', require('./chat.router'));

module.exports= router

const crypto = require('crypto')
const UserModel = require("../models/User.mdoels")
const { JWTService, verifyToken } = require("../utils/jwt")
const { sendResetEmail } = require('../utils/nodemailer')

exports.LoginWithGoogle = async(profile,cb)=>{
    try {
        const chk_user = await UserModel.findOne({email:profile?._json.email})
        if(chk_user){
            // If user exists but doesn't have 'google' in authMethod, add it so email/password remains valid too
            if(!chk_user.authMethod.includes('google')){
                chk_user.authMethod.push('google')
                chk_user.node_id = chk_user.node_id || profile?._json.sub
                chk_user.displayName = chk_user.displayName || profile?._json.name
                chk_user.photo = chk_user.photo || profile?._json.picture
                await chk_user.save()
            }

            const token = JWTService.generateToken({userId:chk_user._id})
            cb(null,token)
            return
        }

        const user = await UserModel.create({
            node_id:profile?._json.sub,
            displayName:profile?._json.name,
            photo:profile?._json.picture,
            email:profile?._json.email,
            authMethod: ['google'],
            points: 0, // Explicitly initialize points
            unlockedGames: ['Basket Hoop'] // Explicitly initialize unlocked games
        })

        const token = JWTService.generateToken({userId:user._id})
        cb(null,token)
    } catch (error) {
        cb(error, null)
    }
}

exports.VerifyToken = verifyToken;

exports.ProfileController = async(req,res)=>{
    try {
        // req.user is set by VerifyToken middleware as an object { _id: '<id>' }
        const userId = req.user && req.user._id ? req.user._id : req.user;
        if (!userId) {
            return res.status(401).json({
                error: "Not authenticated"
            });
        }

        const chk_user = await UserModel.findById(userId);
        if(!chk_user){
            return res.status(404).json({
                error: "User not found"
            });
        }

        // Return user data with all fields
        const userData = chk_user.toObject();
        return res.status(200).json({
            user: {
                _id: userData._id,
                email: userData.email,
                displayName: userData.displayName || userData.name || "",
                name: userData.displayName || userData.name || "",
                photo: userData.photo || "",
                bio: userData.bio || "",
                points: userData.points || 0,
                unlockedGames: userData.unlockedGames || ['Basket Hoop'],
                authMethod: userData.authMethod || [],
                node_id: userData.node_id,
                createdAt: userData.createdAt,
                updatedAt: userData.updatedAt
            }
        });
    } catch (error) {
        console.error('ProfileController error:', error);
        return res.status(500).json({
            error: error.message || "Failed to fetch profile"
        });
    }
}

// Update profile - allow user to update safe fields (displayName, photo, bio)
exports.UpdateProfile = async (req, res) => {
    try {
        const userId = req.user && req.user._id ? req.user._id : req.user;
        const allowed = ['displayName', 'photo', 'bio'];
        const updates = {};
        for (const key of allowed) {
            if (Object.prototype.hasOwnProperty.call(req.body, key)) {
                updates[key] = req.body[key];
            }
        }

        if (Object.keys(updates).length === 0) {
            return res.status(400).json({ error: 'No updatable fields provided' });
        }

        const user = await UserModel.findById(userId);
        if (!user) return res.status(404).json({ error: 'User not found' });

        // apply updates
        Object.assign(user, updates);
        await user.save();

        return res.status(200).json({ success: true, user: user.toObject() });
    } catch (error) {
        console.error('UpdateProfile error:', error);
        return res.status(500).json({ error: error.message || 'Failed to update profile' });
    }
}

    // Debug endpoint: show decoded token payload and the corresponding DB user (for troubleshooting)
    exports.DebugProfile = async (req, res) => {
        try {
            const userPayload = req.user; // set by middleware
            const userId = userPayload && userPayload._id ? userPayload._id : userPayload;
            const userDoc = await UserModel.findById(userId).lean();
            return res.status(200).json({ success: true, tokenPayload: userPayload, user: userDoc });
        } catch (err) {
            console.error('DebugProfile error', err);
            return res.status(500).json({ success: false, error: err.message });
        }
    }

// Email/Password Authentication
exports.Register = async(req,res)=>{
    try {
        const {email, password, displayName} = req.body;
        
        if(!email || !password) {
            return res.status(400).json({
                error: "Email and password are required"
            });
        }

        // Check if user already exists
        const existingUser = await UserModel.findOne({email});
        if(existingUser) {
            return res.status(400).json({
                error: "User already exists with this email"
            });
        }

        // Create new user
        const user = await UserModel.create({
            email,
            password,
            displayName: displayName || email.split('@')[0],
            authMethod: ['email'],
            points: 0, // Explicitly initialize points
            unlockedGames: ['Basket Hoop'] // Explicitly initialize unlocked games
        });

        const token = JWTService.generateToken({userId: user._id});
        
        res.status(201).json({
            message: "User registered successfully",
            token,
            user: {
                id: user._id,
                email: user.email,
                displayName: user.displayName,
                authMethod: user.authMethod
            }
        });
    } catch (error) {
        res.status(500).json({
            error: error.message
        });
    }
}

exports.Login = async(req,res)=>{
    try {
        const {email, password} = req.body;
        
        if(!email || !password) {
            return res.status(400).json({
                error: "Email and password are required"
            });
        }

        // Find user by email
        const user = await UserModel.findOne({email});
        if(!user) {
            return res.status(401).json({
                error: "Invalid credentials"
            });
        }

        // Check if user has password (email auth method)
        if(!user.authMethod.includes('email') || !user.password) {
            return res.status(401).json({
                error: "Please use Google sign-in for this account"
            });
        }

        // Compare password
        const isPasswordValid = await user.comparePassword(password);
        if(!isPasswordValid) {
            return res.status(401).json({
                error: "Invalid credentials"
            });
        }

        const token = JWTService.generateToken({userId: user._id});
        
        res.status(200).json({
            message: "Login successful",
            token,
            user: {
                id: user._id,
                email: user.email,
                displayName: user.displayName,
                authMethod: user.authMethod
            }
        });
    } catch (error) {
        res.status(500).json({
            error: error.message
        });
    }
}

// Request password reset - generates a token, stores it on user, sends email
exports.ForgotPassword = async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) return res.status(400).json({ error: 'Email is required' });

        const user = await UserModel.findOne({ email });
        if (!user) {
            // Security: don't reveal whether email exists
            console.log(`Password reset attempt for non-existent email: ${email}`);
            return res.status(200).json({ message: 'If that email exists, a reset link has been sent' });
        }

        // generate token
        const token = crypto.randomBytes(32).toString('hex');
        user.resetPasswordToken = token;
        // expire in 1 hour
        user.resetPasswordExpires = Date.now() + 3600000;
        await user.save();

        // send email
        const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${token}&email=${encodeURIComponent(email)}`;

        try {
            await sendResetEmail(email, resetUrl);
            console.log(`✅ Password reset email sent to: ${email}`);
        } catch (emailError) {
            console.error(`⚠️ Failed to send reset email to ${email}:`, emailError.message);
            // Log the error but don't fail the request - token is already saved
            // This way users know to check their email even if sending failed
            // In production, you might want to alert admins or use a fallback service
            console.error('Email service error - user token saved, email may need manual resend');
            // Still return success to user as token is saved
        }

        return res.status(200).json({ message: 'If that email exists, a reset link has been sent' });
    } catch (error) {
        console.error('ForgotPassword error:', error);
        return res.status(500).json({ error: error.message });
    }
}

// Reset password - sets new password if token valid
exports.ResetPassword = async (req, res) => {
    try {
        const { token, email, password } = req.body;
        if (!token || !email || !password) return res.status(400).json({ error: 'Token, email and new password are required' });

        const user = await UserModel.findOne({ email, resetPasswordToken: token, resetPasswordExpires: { $gt: Date.now() } });
        if (!user) return res.status(400).json({ error: 'Invalid or expired token' });

        user.password = password;
        user.resetPasswordToken = undefined;
        user.resetPasswordExpires = undefined;
        // ensure email authMethod exists
        if (!user.authMethod.includes('email')) user.authMethod.push('email');
        await user.save();

        const jwtToken = JWTService.generateToken({ userId: user._id });

        return res.status(200).json({ message: 'Password reset successful', token: jwtToken });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}


const crypto = require('crypto');
const UserModel = require("../models/User.mdoels");
const { JWTService, verifyToken } = require("../utils/jwt");
const { sendResetEmail } = require('../utils/nodemailer');

// --------------------- GOOGLE LOGIN ---------------------
exports.LoginWithGoogle = async (profile, cb) => {
    try {
        const chk_user = await UserModel.findOne({ email: profile?._json.email });

        if (chk_user) {
            if (!chk_user.authMethod.includes('google')) {
                chk_user.authMethod.push('google');
                chk_user.node_id = chk_user.node_id || profile?._json.sub;
                chk_user.displayName = chk_user.displayName || profile?._json.name;
                chk_user.photo = chk_user.photo || profile?._json.picture;
                await chk_user.save();
            }

            const token = JWTService.generateToken({ userId: chk_user._id });
            return cb(null, token);
        }

        const user = await UserModel.create({
            node_id: profile?._json.sub,
            displayName: profile?._json.name,
            photo: profile?._json.picture,
            email: profile?._json.email,
            authMethod: ['google'],
            points: 0,
            unlockedGames: ['Basket Hoop']
        });

        const token = JWTService.generateToken({ userId: user._id });
        cb(null, token);

    } catch (error) {
        cb(error, null);
    }
};

exports.VerifyToken = verifyToken;

// --------------------- PROFILE ---------------------
exports.ProfileController = async (req, res) => {
    try {
        const userId = req.user?._id || req.user;
        if (!userId)
            return res.status(401).json({ error: "Not authenticated" });

        const user = await UserModel.findById(userId);
        if (!user)
            return res.status(404).json({ error: "User not found" });

        return res.status(200).json({
            user: {
                _id: user._id,
                email: user.email,
                displayName: user.displayName || "",
                name: user.displayName || "",
                photo: user.photo || "",
                bio: user.bio || "",
                points: user.points || 0,
                unlockedGames: user.unlockedGames || ['Basket Hoop'],
                authMethod: user.authMethod || [],
                node_id: user.node_id,
                createdAt: user.createdAt,
                updatedAt: user.updatedAt
            }
        });

    } catch (error) {
        console.error("ProfileController error:", error);
        res.status(500).json({ error: error.message });
    }
};

// --------------------- UPDATE PROFILE ---------------------
exports.UpdateProfile = async (req, res) => {
    try {
        const userId = req.user?._id || req.user;
        const allowed = ['displayName', 'photo,', 'bio'];
        const updates = {};

        for (const key of allowed) {
            if (req.body[key] !== undefined) updates[key] = req.body[key];
        }

        if (!Object.keys(updates).length)
            return res.status(400).json({ error: "No updatable fields provided" });

        const user = await UserModel.findById(userId);
        if (!user)
            return res.status(404).json({ error: "User not found" });

        Object.assign(user, updates);
        await user.save();

        res.status(200).json({ success: true, user: user.toObject() });

    } catch (error) {
        console.error("UpdateProfile error:", error);
        res.status(500).json({ error: error.message });
    }
};

// --------------------- DEBUG PROFILE ---------------------
exports.DebugProfile = async (req, res) => {
    try {
        const userId = req.user?._id || req.user;
        const userDoc = await UserModel.findById(userId).lean();

        return res.status(200).json({
            success: true,
            tokenPayload: req.user,
            user: userDoc
        });

    } catch (err) {
        console.error("DebugProfile error:", err);
        res.status(500).json({ error: err.message });
    }
};

// --------------------- REGISTER ---------------------
exports.Register = async (req, res) => {
    try {
        const { email, password, displayName } = req.body;

        if (!email || !password)
            return res.status(400).json({ error: "Email and password are required" });

        const existing = await UserModel.findOne({ email });
        if (existing)
            return res.status(400).json({ error: "User already exists with this email" });

        const user = await UserModel.create({
            email,
            password,
            displayName: displayName || email.split('@')[0],
            authMethod: ['email'],
            points: 0,
            unlockedGames: ['Basket Hoop']
        });

        const token = JWTService.generateToken({ userId: user._id });

        return res.status(201).json({
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
        res.status(500).json({ error: error.message });
    }
};

// --------------------- LOGIN ---------------------
exports.Login = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password)
            return res.status(400).json({ error: "Email and password are required" });

        const user = await UserModel.findOne({ email });
        if (!user)
            return res.status(401).json({ error: "Invalid credentials" });

        if (!user.authMethod.includes('email') || !user.password)
            return res.status(401).json({ error: "Please use Google sign-in for this account" });

        const isValid = await user.comparePassword(password);
        if (!isValid)
            return res.status(401).json({ error: "Invalid credentials" });

        const token = JWTService.generateToken({ userId: user._id });

        return res.status(200).json({
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
        res.status(500).json({ error: error.message });
    }
};

// --------------------- FORGOT PASSWORD ---------------------
exports.ForgotPassword = async (req, res) => {
    try {
        const { email } = req.body;

        if (!email)
            return res.status(400).json({ error: "Email is required" });

        const user = await UserModel.findOne({ email });

        // Always respond success (for security)
        if (!user) {
            console.log(`Password reset attempt for non-existent email: ${email}`);
            return res.status(200).json({ message: "If that email exists, a reset link has been sent" });
        }

        // Create reset token
        const token = crypto.randomBytes(32).toString("hex");
        user.resetPasswordToken = token;
        user.resetPasswordExpires = Date.now() + 3600000; // 1 hr
        await user.save();

        const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${token}&email=${encodeURIComponent(email)}`;

        try {
            await sendResetEmail(email, resetUrl);
            console.log(`✅ Password reset email sent to ${email}`);
        } catch (err) {
            console.error(`❌ Email sending failed: ${err.message}`);
            console.error("Email service error — token saved, email may need manual resend.");
        }

        return res.status(200).json({ message: "If that email exists, a reset link has been sent" });

    } catch (error) {
        console.error("ForgotPassword error:", error);
        res.status(500).json({ error: error.message });
    }
};

// --------------------- RESET PASSWORD ---------------------
exports.ResetPassword = async (req, res) => {
    try {
        const { token, email, password } = req.body;

        if (!token || !email || !password)
            return res.status(400).json({ error: "Token, email and new password are required" });

        const user = await UserModel.findOne({
            email,
            resetPasswordToken: token,
            resetPasswordExpires: { $gt: Date.now() }
        });

        if (!user)
            return res.status(400).json({ error: "Invalid or expired token" });

        user.password = password;
        user.resetPasswordToken = undefined;
        user.resetPasswordExpires = undefined;

        if (!user.authMethod.includes('email'))
            user.authMethod.push('email');

        await user.save();

        const jwtToken = JWTService.generateToken({ userId: user._id });

        return res.status(200).json({
            message: "Password reset successful",
            token: jwtToken
        });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const Router = require("express").Router();
const bcrypt = require("bcrypt");
const crypto = require("crypto")
const validator = require("express-validator")

const User = require("../models/User");
const App = require("../models/App");
const Session = require("../models/Session");
const Otp = require("../models/Otp");

const { logError } = require("../modules/logs");
const sendEmail = require("../modules/SMTP/send");
const { issueSession } = require("../modules/auth/session");

function createOtpAndSend(userId, email, purpose) {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiry = Date.now() + 10 * 60 * 1000;

    return Otp.insertOne({
        userId,
        code,
        purpose: purpose,
        expiresAt: new Date(otpExpiry),
        lastSentAt: Date.now()
    })
        .then(() => {
            console.log(`OTP for user ${userId} is ${code}. It will expire in 10 minutes.`);
            // sendEmail(email, "Your OTP Code", `<p>Your OTP code is: <strong>${otp}</strong></p><p>This code will expire in 10 minutes.</p>`);
        });
}

const expressRT = require('express-rate-limit');
const limiter = expressRT({
    windowMs: 5 * 60 * 1000, // 15 minutes
    max: 15,
    message: 'Too many requests from this IP, please try again after 15 minutes'
});
Router.use(limiter);

Router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ success: false, message: "Email and password are required." });
        }

        const user = await User.findOne({ email });

        if (!user) {
            return res.status(401).json({ success: false, message: "Invalid credentials." });
        }

        if (!user.isVerified) {
            await Otp.deleteMany({ userId: user._id });
            await createOtpAndSend(user._id, email);

            return res.status(403).json({ success: false, message: "Account not verified. Please verify your account.", verified: false });
        }

        const isPasswordValid = await bcrypt.compare(password, user.password);

        if (!isPasswordValid) {
            return res.status(400).json({ success: false, message: "Invalid credentials." });
        }

        const accessToken = await issueSession(user, req, res, 'login');                    // TODO 
        res.status(200).json({ success: true, message: "Login successful.", accessToken, redirectURL: '/dashboard' });

    } catch (error) {
        logError(error);
        res.status(500).json({ success: false, message: "Internal server error." });
    }
});


Router.post('/verify-otp', async (req, res) => {
    try {
        const { email, otp, redirectURL } = req.body;

        if (!email || !otp) {
            return res.status(400).json({ success: false, message: "Email and OTP are required." });
        }

        const user = await User.findOne({ email });

        if (!user) {
            return res.status(404).json({ success: false, message: "User not found." });
        }

        const existingOtp = await Otp.findOne({ userId: user._id });

        if (!existingOtp) {
            return res.status(404).json({ success: false, message: "OTP not found. Please request a new one." });
        }

        if (existingOtp.expiresAt < new Date()) {
            await Otp.deleteOne({ userId: user._id });
            return res.status(400).json({ success: false, message: "OTP has expired. Please request a new one." });
        }

        if (existingOtp.otp !== otp || existingOtp.tries >= existingOtp.maxTries) {
            existingOtp.tries = existingOtp.tries + 1
            existingOtp.save()
            return res.status(400).json({ success: false, message: "Invalid OTP." });
        }

        user.emailVerifiedAt = true;
        user.verificatedAt = new Date();
        await user.save();

        await Otp.deleteOne({ userId: user._id });

        const tokens = await issueSession(user, req, res, 'register');

        let finalUrl = `${redirectURL}/?code=${tokens.refreshToken}`

        res.status(200).json({ success: true, message: "OTP verified successfully.", accessToken: tokens.accessToken, redirectURL: finalUrl || '/dashboard' });

    } catch (error) {
        logError(error);
        res.status(500).json({ success: false, message: "Internal server error." });
    }
});

Router.post('/resend-otp', async (req, res) => {
    try {

        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ success: false, message: "Email is required." });
        }

        const user = await User.findOne({ email });

        if (!user) {
            return res.status(404).json({ success: false, message: "User not found." });
        }

        const otp = await Otp.findOne({userId: user._id})

        if(Date.now() > (Date.parse(otp.lastSentAt) - 60 * 1000)){
            return res.status(429).json({success: false, message: "You have to wait at least 1 minute to request a new code."})
        }

        await Otp.deleteMany({ userId: user._id });
        await createOtpAndSend(user._id, email, "verify_email");

        res.status(200).json({ success: true, message: "OTP sent successfully." });

    } catch (error) {
        logError(error);
        res.status(500).json({ success: false, message: "Internal server error." });
    }
})

const signupRules = [
    // Mandatory
    validator.body("username").trim().notEmpty().isLength({ min: 3, max: 32 }),
    validator.body("email").trim().isEmail().normalizeEmail(),
    validator.body("password").isLength({ min: 8, max: 128 }),
    validator.body("termsAccepted")
        .isBoolean().toBoolean()
        .custom(v => v === true).withMessage("Terms must be accepted."),

    // Profile
    validator.body("displayName").optional().trim().isLength({ max: 64 }),
    validator.body("avatarUrl").optional().trim().isURL({ protocols: ["http", "https"] }),
    validator.body("bannerUrl").optional().trim().isURL({ protocols: ["http", "https"] }),
    validator.body("bio").optional().trim().isLength({ max: 500 }),
    validator.body("locale").optional().trim().isLocale(),

    // Misc
    validator.body("phone").optional().trim().isMobilePhone("any"),
    validator.body("birthDate").optional().isISO8601().toDate(),

    // Address
    validator.body("address").optional().isObject(),
    validator.body("address.country").if(validator.body("address").exists())
        .trim().toUpperCase().isISO31661Alpha2(),
    validator.body("address.city").if(validator.body("address").exists())
        .trim().notEmpty().isLength({ max: 100 }),
    validator.body("address.street").optional().trim().isLength({ max: 150 }),
    validator.body("address.number").optional().trim().isLength({ max: 20 }),
    validator.body("address.complement").optional().trim().isLength({ max: 100 }),
    validator.body("address.state").optional().trim().isLength({ max: 100 }),
    validator.body("address.zip").optional().trim().isPostalCode("any"),
]

Router.post("/signup", signupRules, async (req, res) => {

    const errors = validator.validationResult(req)

    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, message: "One or more fields are invalid or missing.", errors: errors.array() })
    }

    try {
        const { password, termsAccepted, ...rest } = validator.matchedData(req, { location: ["body"] })

        const user = await User.findOne({ $or: [{ username: rest.username }, { email: rest.email }] })

        if (user) {
            return res.status(400).json({ success: false, message: "Username or email already exists" })
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const newUser = await new User({
            ...rest,
            password: hashedPassword,
            termsAcceptedAt: Date.now()
        }).save()

        if (!newUser) {
            return res.status(500).json({ success: false, message: "Failed to create user." });
        }

        await createOtpAndSend(newUser._id, newUser.email, "verify_email");

        res.status(201).json({
            success: true,
            message: "Account created. Please check your email for the verification code.",
            email: newUser.email,
            requiresVerification: true,
        });

    } catch (error) {

        logError(error);

        res.status(500).json({ success: false, message: "Internal server error." });

    }
})

Router.post('/logout', async (req, res) => {
    try {
        let token = req.cookies['refreshToken'];
        if (!token) {
            return res.status(400).json({ success: false, message: "No refresh token provided." });
        }
        token = crypto.createHash('sha256').update(token).digest('hex');

        const session = await Session.findOne({ refreshToken: token });
        if (!session) {
            return res.status(400).json({ success: false, message: "Invalid session." });
        }

        session.revokedBy = 'user';
        session.revokedAt = new Date();
        await session.save();

        res.clearCookie('refreshToken');
        res.status(200).json({ success: true, message: "Logged out successfully." });

    } catch (error) {
        logError(error);
        res.status(500).json({ success: false, message: "Internal server error." });
    }
})

module.exports = Router;
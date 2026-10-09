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
const { issueSession, hashToken, setRefreshCookie, signAccessToken } = require("../modules/auth/session");

async function createOtpAndSend(userId, email, purpose, res) {
    try {
        const code = crypto.randomInt(100000, 1000000).toString()
        const otpExpiry = Date.now() + 10 * 60 * 1000;

        if (!purpose) {
            throw new Error("Purpose is required")
        }
        const otp = await Otp.findOne({ userId, purpose })

        if (otp) {
            otp.code = code
            otp.expiresAt = new Date(otpExpiry)
            otp.purpose = purpose
            otp.lastSentAt = Date.now()
            otp.tries = 0

            await otp.save()
                .then(() => {
                    console.log(`OTP for user ${userId} is ${code}. It will expire in 10 minutes.`);
                    // sendEmail(email, "Your OTP Code", `<p>Your OTP code is: <strong>${code}</strong></p><p>This code will expire in 10 minutes.</p>`);
                });
            return { success: true, messsage: "Otp code send successfully." }
        }
        await Otp.create({
            userId,
            code,
            purpose: purpose,
            expiresAt: new Date(otpExpiry),
            lastSentAt: Date.now()
        }).then(() => {
            console.log(`OTP for user ${userId} is ${code}. It will expire in 10 minutes.`);
            // sendEmail(email, "Your OTP Code", `<p>Your OTP code is: <strong>${code}</strong></p><p>This code will expire in 10 minutes.</p>`);
        });

        return { success: true, messsage: "Otp code send successfully." }


    } catch (error) {
        logError(error)
        res.status(500).json({ success: false, message: "Internal server error" })
    }
}

const expressRT = require('express-rate-limit');
const limiter = expressRT({
    windowMs: 5 * 60 * 1000, // 15 minutes
    max: 15,
    message: 'Too many requests from this IP, please try again after 5 minutes'
});
Router.use(limiter);

Router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ success: false, message: "Email and password are required." });
        }

        const user = await User.findOne({ email }).select("+password")

        if (!user) {
            return res.status(401).json({ success: false, message: "User not found or invalid credentials." });
        }

        const isPasswordValid = await bcrypt.compare(password, user.password);

        if (!isPasswordValid) {
            return res.status(401).json({ success: false, message: "User not found or invalid credentials." });
        }
        if (!user.emailVerifiedAt) {
            await Otp.deleteMany({ userId: user._id });
            await createOtpAndSend(user._id, email, "verify_email", res);

            return res.status(403).json({ success: false, message: "Account not verified. Please verify your account.", verified: false });
        }


        const accessToken = await issueSession(user, req, res, 'login');                    // TODO 
        res.status(200).json({ success: true, message: "Login successful.", accessToken: accessToken.accessToken, redirectURL: '/dashboard' });

    } catch (error) {
        logError(error);
        res.status(500).json({ success: false, message: "Internal server error." });
    }
});


Router.post('/verify-otp', async (req, res) => {
    try {
        const { email, otp, purpose } = req.body;

        let redirectURL = req.body.redirectURL
        if (!req.body.redirectURL) {
            redirectURL = '/dashboard'
        }

        if (!email || !otp) {
            return res.status(400).json({ success: false, message: "Email and OTP are required." });
        }

        const user = await User.findOne({ email });

        if (!user) {
            return res.status(404).json({ success: false, message: "OTP expired or not found. Please request a new one." });
        }

        const existingOtp = await Otp.findOneAndUpdate(
            {
                userId: user._id,
                ...(purpose !== undefined && { purpose }),
                expiresAt: {
                    $gt: new Date()
                }
            },
            { $inc: { tries: 1 } },
            { returnDocument: "after" }
        ).select("+code")

        if (!existingOtp) {
            return res.status(404).json({ success: false, message: "OTP expired or not found. Please request a new one." });
        }

        if (existingOtp.expiresAt < new Date()) {
            await Otp.deleteOne({ userId: user._id });
            return res.status(400).json({ success: false, message: "OTP expired or not found. Please request a new one." });
        }

        if (existingOtp.tries > existingOtp.maxTries) {
            return res.status(429).json({ success: false, message: "Too many attempts. Please request a new code" })
        }

        if (existingOtp.code !== otp) {
            return res.status(400).json({ success: false, message: "Invalid OTP." });
        }

        if (purpose === 'verify_email') {
            user.emailVerifiedAt = new Date();
            await user.save();
        }

        await Otp.deleteOne({ userId: user._id, purpose });

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

        const { email, purpose } = req.body;

        if (!email) {
            return res.status(400).json({ success: false, message: "Email is required." });
        }

        const user = await User.findOne({ email, purpose });

        if (!user) {
            return res.status(404).json({ success: false, message: "User not found." });
        }

        const otp = await Otp.findOne({ userId: user._id })

        if (otp) {
            if (Date.now() < (Date.parse(otp.lastSentAt) + 60 * 1000)) {
                return res.status(429).json({ success: false, message: "You have to wait at least 1 minute to request a new code." })
            }

            if (user.emailVerifiedAt && (otp.purpose == 'verify_email' && purpose == 'verify_email')) {
                return res.status(200).json({ success: true, message: "Email already verified" })
            }

        }

        await Otp.deleteMany({ userId: user._id, purpose: purpose });
        await createOtpAndSend(user._id, email, purpose, res);

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
            profile: {
                displayName: rest.displayName,
                avatarUrl: rest.avatarUrl,
                bannerUrl: rest.bannerUrl,
                bio: rest.bio,
                locale: rest.locale
            },
            password: hashedPassword,
            termsAcceptedAt: Date.now()
        }).save()

        if (!newUser) {
            return res.status(500).json({ success: false, message: "Failed to create user." });
        }

        await createOtpAndSend(newUser._id, newUser.email, "verify_email", res);

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

        res.clearCookie('refreshToken', { path: '/api/auth' });
        res.status(200).json({ success: true, message: "Logged out successfully." });

    } catch (error) {
        logError(error);
        res.status(500).json({ success: false, message: "Internal server error." });
    }
})

Router.post('/refresh', async (req, res) => {
    try {
        const raw = req.cookies?.refreshToken;

        if (!raw || typeof raw !== "string") {
            return res.status(401).json({ success: false, message: "Refresh token is missing." });
        }

        const oldHash = hashToken(raw);
        const newRaw = crypto.randomBytes(64).toString('hex');

        const session = await Session.findOneAndUpdate(
            { refreshToken: oldHash, revokedAt: null, expiresAt: { $gt: new Date() } },
            {
                $set: {
                    refreshToken: hashToken(newRaw),
                    lastRefreshToken: oldHash,
                    rotatedAt: new Date()
                }
            },
            { returnDocument: "after" }
        )

        if (!session) {
            const reused = await Session.findOne({ lastRefreshToken: oldHash });
            if (reused) {
                const GRACE_MS = 10 * 1000;
                if (((Date.now() - reused.rotatedAt.getTime()) <= GRACE_MS) && reused.revokedAt === null) {
                    const user = User.findById(reused.userId)
                    if (user && user.emailVerifiedAt) {
                        return res.status(200).json({ sucess: true, message: "Session refreshed successfully", data: [signAccessToken(user._id, reused._id)] })
                    } else {
                        await Session.updateMany(
                            { userId: reused.userId, revokedAt: null },
                            { $set: { revokedAt: new Date(), revokedBy: 'reuse_detected' } }
                        );
                    }
                }
                res.clearCookie('refreshToken', { path: '/api/auth' });
                return res.status(401).json({ success: false, message: "Invalid or expired session." });
            }
        }

        const user = await User.findById(session.userId);

        if (!user || !user.emailVerifiedAt) {
            session.revokedBy = 'system';
            session.revokedAt = new Date();
            await session.save();

            res.clearCookie('refreshToken', { path: '/api/auth' });
            return res.status(401).json({ success: false, message: "Invalid or expired session." });
        }

        setRefreshCookie(res, newRaw);

        res.status(200).json({
            success: true,
            accessToken: signAccessToken(user._id, session._id)
        });

    } catch (error) {
        logError(error);
        res.status(500).json({ success: false, message: "Internal server error." });
    }
});

Router.post('/forgot-password', async (req, res) => {
    try {
        const { email } = req.body

        if (!email) {
            return res.status(400).json({ success: false, message: "Missing required fields" })
        }

        const user = await User.findOne({ email })

        if (!user) {
            return res.status(200).json({ success: true, message: "If this email exists you will recieve a code." })
        }

        await createOtpAndSend(user._id, email, "password_reset", res)

        res.status(200).json({ success: true, message: "If this email exists you will recieve a code." })

    } catch (err) {
        logError(err)
        res.status(500).json({ success: false, message: "Internal server error." })
    }
})

Router.post('/reset-password', async (req, res) => {
    try {
        const { email, code, confirmPassword, newPassword } = req.body

        if (!email || !code || !confirmPassword || !newPassword) {
            return res.status(401).json({ success: false, message: "Missing required fields" })
        }

        if (String(confirmPassword) !== String(newPassword)) {
            return res.status(400).json({ success: false, message: "Password must match." })
        }

        const user = await User.findOne({ email }).select("+password")

        if (!user) {
            return res.status(404).json({ success: false, message: "User not found." })
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        user.password = hashedPassword
        await user.save()

        res.status(200).json({ success: true, message: "Password changed successfully." })

    } catch (error) {
        logError(error)
        res.status(500).json({ success: false, message: "Internal server error." })
    }
})

// OAuth Routes

Router.get('/:provider', async (req, res) => {
    try {
        let provider = req.params.provider
        provider = String(provider).toLowerCase()

        if (!provider) {
            return res.status(500).json({ success: false, message: "Something went wrong. Please try again" })
        }

        switch (provider) {
            case "google":
                return res.status(308).redirect(process.env.GOOGLE_REDIRECT_URL)
            case "x":
                return res.status(308).redirect(process.env.X_REDIRECT_URL)
            case "apple":
                return res.status(308).redirect(process.env.APPLE_REDIRECT_URL)
            default:
                return res.status(308).redirect(process.env.MAIN_URL)
        }


    } catch (error) {
        logError(error)
        res.status(500).json({ success: false, message: "Internal server error" })
    }
})
// TO BE DEFINED LATER
/*
Router.get('/:provider/callback', async (req, res) => {
    try {
        let provider = req.params.provider
        provider = String(provider).toLowerCase()

        if(!provider){
            return res.status(500).json({success: false, message: "Something went wrong. Please try again"})
        }

        switch (provider){
            case "google":
                return res.status(308).redirect(process.env.GOOGLE_REDIRECT_URL)
            case "x":
                return res.status(308).redirect(process.env.X_REDIRECT_URL)
            case "apple":
                return res.status(308).redirect(process.env.APPLE_REDIRECT_URL)
            default:
                return res.status(308).redirect(process.env.MAIN_URL)
        }


    } catch (error) {
        logError(error)
        res.status(500).json({success: false, message: "Internal server error"})
    }
})*/

module.exports = Router;
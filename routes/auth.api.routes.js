const Router = require("express").Router();
const bcrypt = require("bcrypt");
const crypto = require("crypto")
const validator = require("express-validator")

const User = require("../models/User");
const App = require("../models/App");
const Session = require("../models/Session");
const Otp = require("../models/Otp");
const Identity = require("../models/Identity");

const { logError } = require("../modules/logs");
const sendEmail = require("../modules/SMTP/send");
const { refreshCookieOptions, issueSession, hashToken, setRefreshCookie, signAccessToken } = require("../modules/auth/session");

async function createOtpAndSend(userId, email, purpose) {
    try {
        const code = crypto.randomInt(100000, 1000000).toString()
        const otpExpiry = Date.now() + 10 * 60 * 1000;

        if (!purpose) {
            throw new Error("Purpose is required")
        }
        const otp = await Otp.findOne({ userId, purpose })

        if (otp) {
            otp.otpCode = await bcrypt.hash(code, 10)
            otp.expiresAt = new Date(otpExpiry)
            otp.purpose = purpose
            otp.lastSentAt = Date.now()
            otp.tries = 0

            await otp.save()
                .then(() => {
                    sendEmail(email, "Your auth code", `Your auth code is ${code}, and it will expire in 10 minutes.`)
                });
            return { success: true, messsage: "Otp code send successfully." }
        }
        await Otp.create({
            userId,
            otpCode: await bcrypt.hash(code, 10),
            purpose: purpose,
            expiresAt: new Date(otpExpiry),
            lastSentAt: Date.now()
        }).then(() => {
            sendEmail(email, "Your auth code", `Your auth code is ${code}, and it will expire in 10 minutes.`)
        });

        return { success: true, messsage: "Otp code send successfully." }


    } catch (error) {
        logError(error)
        throw error
    }
}

const expressRT = require('express-rate-limit');
const limiter = expressRT({
    windowMs: 5 * 60 * 1000,
    max: 15,
    message: 'Too many requests from this IP, please try again after 5 minutes'
});
const strict = ['/login', '/signup', '/verify-otp', '/resend-otp', '/forgot-password', '/reset-password'];
Router.use((req, res, next) => strict.includes(req.path) ? limiter(req, res, next) : next());

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

        if (user.status !== 'active') {
            return res.status(403).json({ success: false, message: "Authorization error, account not active" })
        }

        const isPasswordValid = await bcrypt.compare(password, user.password);

        if (!isPasswordValid) {
            return res.status(401).json({ success: false, message: "User not found or invalid credentials." });
        }
        if (!user.emailVerifiedAt) {
            await Otp.deleteMany({ userId: user._id });
            await createOtpAndSend(user._id, email, "verify_email");
            return res.status(403).json({ success: false, message: "Account not verified. Please verify your account.", verified: false });
        }


        const accessToken = await issueSession(user, req, res, 'login');
        res.status(200).json({ success: true, message: "Login successful.", accessToken: accessToken.accessToken, redirectURL: '/dashboard' });

    } catch (error) {
        logError(error);
        res.status(500).json({ success: false, message: "Internal server error." });
    }
});


Router.post('/verify-otp', async (req, res) => {
    try {
        const { email, otp, purpose } = req.body;


        if (!email || !otp || !purpose || !["verify_email", "login"].includes(purpose)) {
            return res.status(400).json({ success: false, message: "Email, OTP and purpose are required." });
        }

        const user = await User.findOne({ email });

        if (!user) {
            return res.status(404).json({ success: false, message: "OTP expired or not found. Please request a new one." });
        }
        if (user.status !== 'active') {
            return res.status(403).json({ success: false, message: "Authorization error, account not active" })
        }

        const existingOtp = await Otp.findOne({
            userId: user._id,
            purpose,
            expiresAt: { $gt: new Date() }
        }).select("+otpCode")

        if (!existingOtp) {
            return res.status(404).json({ success: false, message: "OTP expired or not found. Please request a new one." });
        }

        if (existingOtp.expiresAt < new Date()) {
            await Otp.deleteOne({ userId: user._id });
            return res.status(400).json({ success: false, message: "OTP expired or not found. Please request a new one." });
        }

        if (existingOtp.tries >= existingOtp.maxTries) {
            return res.status(429).json({ success: false, message: "Too many attempts. Please request a new code" })
        }

        if (!await bcrypt.compare(String(otp), existingOtp.otpCode)) {
            existingOtp.tries += 1
            await existingOtp.save()
            return res.status(400).json({ success: false, message: "Invalid OTP." });
        }

        if (purpose === 'verify_email') {
            user.emailVerifiedAt = new Date();
            await user.save();
        }

        await Otp.deleteOne({ userId: user._id, purpose });

        const tokens = await issueSession(user, req, res, 'register');

        res.status(200).json({ success: true, message: "OTP verified successfully.", accessToken: tokens.accessToken });

    } catch (error) {
        logError(error);
        res.status(500).json({ success: false, message: "Internal server error." });
    }
});

Router.post('/resend-otp', async (req, res) => {
    try {

        const { email, purpose } = req.body;

        if (!email || !purpose || purpose === null || !["verify_email", "login", "password_reset"].includes(purpose)) {
            return res.status(400).json({ success: false, message: "Email and purpose are required. One field is missing or has an invalid value" });
        }

        const user = await User.findOne({ email });

        if (!user) {
            return res.status(404).json({ success: false, message: "User not found." });
        }
        if (user.status !== 'active') {
            return res.status(403).json({ success: false, message: "Authorization error, account not active" })
        }

        const otp = await Otp.findOne({ userId: user._id, purpose })

        if (otp) {
            if (Date.now() < (Date.parse(otp.lastSentAt) + 60 * 1000)) {
                return res.status(429).json({ success: false, message: "You have to wait at least 1 minute to request a new code." })
            }
        }
        if (user.emailVerifiedAt && purpose == 'verify_email') {
            return res.status(200).json({ success: true, message: "Email already verified" })
        }

        await Otp.deleteMany({ userId: user._id, purpose: purpose });
        await createOtpAndSend(user._id, email, purpose);

        res.status(200).json({ success: true, message: "OTP sent successfully." });

    } catch (error) {
        logError(error);
        res.status(500).json({ success: false, message: "Internal server error." });
    }
})

Router.post("/signup", async (req, res) => {
    try {
        const { password, termsAccepted, email, username, ...provided } = req.body
        const rest = { email, username }
        for (const field of ['displayName', 'avatarUrl', 'bannerUrl', 'bio', 'locale', 'phone', 'address', 'birthDate']) {
            if (provided[field] !== undefined) rest[field] = provided[field]
        }
        if (!password || !rest.email || !rest.username) {
            return res.status(400).json({ success: false, message: "Missing required fields." })
        }

        if (!termsAccepted) {
            return res.status(401).json({ success: false, message: "You have to accept the terms and conditions" })
        }

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

        const session = await Session.findOne({ refreshToken: hashToken(token) }).select('+refreshToken')
        if (!session) {
            return res.status(400).json({ success: false, message: "Invalid session." });
        }

        session.revokedBy = 'user';
        session.revokedAt = new Date();
        await session.save();

        res.clearCookie('refreshToken', refreshCookieOptions);
        res.status(200).json({ success: true, message: "Logged out successfully." });

    } catch (error) {
        logError(error);
        res.status(500).json({ success: false, message: "Internal server error." });
    }
})
Router.get('/logout', async (req, res) => {
    try {
        let token = req.cookies.refreshToken
        if (!token) {
            return res.status(400).json({ success: false, message: "No refresh token provided." });
        }

        const session = await Session.findOne({ refreshToken: hashToken(token) }).select('+refreshToken')
        if (!session) {
            return res.status(400).json({ success: false, message: "Invalid session." });
        }

        session.revokedBy = 'user';
        session.revokedAt = new Date();
        await session.save();

        res.clearCookie('refreshToken', refreshCookieOptions);
        res.redirect('/')

    } catch (error) {
        logError(error);
        res.status(500).json({ success: false, message: "Internal server error." });
    }
})

Router.post('/refresh', async (req, res) => {
    const GRACE_MS = 10 * 1000;
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
        );

        if (!session) {
            const reused = await Session.findOne({
                lastRefreshToken: oldHash,
                revokedAt: null,
                expiresAt: { $gt: new Date() }
            });

            if (!reused) {
                res.clearCookie('refreshToken', refreshCookieOptions);
                return res.status(401).json({ success: false, message: "Session not found" });
            }

            const withinGrace = (Date.now() - new Date(reused.rotatedAt).getTime()) <= GRACE_MS;

            if (withinGrace) {
                const user = await User.findById(reused.userId);

                if (user && user.emailVerifiedAt) {
                    return res.status(200).json({
                        success: true,
                        accessToken: signAccessToken(user._id, reused._id)
                    });
                }

                reused.revokedBy = 'system';
                reused.revokedAt = new Date();
                await reused.save();

                res.clearCookie('refreshToken', refreshCookieOptions);
                return res.status(401).json({ success: false, message: "Invalid or expired session." });
            }

            await Session.updateMany(
                { _id: reused._id },
                { $set: { revokedAt: new Date(), revokedBy: 'reuse_detected' } }
            );

            res.clearCookie('refreshToken', refreshCookieOptions);
            return res.status(401).json({ success: false, message: "Invalid or expired session." });
        }

        const user = await User.findById(session.userId);

        if (!user || !user.emailVerifiedAt) {
            session.revokedBy = 'system';
            session.revokedAt = new Date();
            await session.save();

            res.clearCookie('refreshToken', refreshCookieOptions);
            return res.status(401).json({ success: false, message: "Invalid or expired session." });
        }

        if (user.status !== 'active') {
            return res.status(403).json({ success: false, message: "Authorization error, account not active" })
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
        if (user.status !== 'active') {
            return res.status(403).json({ success: false, message: "Authorization error, account not active" })
        }

        await createOtpAndSend(user._id, email, "password_reset")

        res.status(200).json({ success: true, message: "If this email exists you will recieve a code." })

    } catch (err) {
        logError(err)
        res.status(500).json({ success: false, message: "Internal server error." })
    }
})

Router.post('/reset-password', async (req, res) => {
    try {
        const { email, otp, confirmPassword, newPassword } = req.body

        if (!email || !otp || !confirmPassword || !newPassword) {
            return res.status(401).json({ success: false, message: "Missing required fields" })
        }

        if (String(confirmPassword) !== String(newPassword)) {
            return res.status(400).json({ success: false, message: "Password must match." })
        }

        const user = await User.findOne({ email }).select("+password")

        if (!user) {
            return res.status(404).json({ success: false, message: "User not found." })
        }
        if (user.status !== 'active') {
            return res.status(403).json({ success: false, message: "Authorization error, account not active" })
        }
        const findOtp = await Otp.findOne({
            userId: user._id,
            purpose: 'password_reset'
        }).select('+otpCode')

        if (!findOtp) {
            return res.status(404).json({ success: false, message: "Invalid otp" })
        }
        if (findOtp.expiresAt < Date.now()) {
            return res.status(401).json({ success: true, message: "Expired otp, request a new one." })
        }
        if (findOtp.tries >= findOtp.maxTries) {
            return res.status(401).json({ success: false, message: "You have reached the maximun attempt" })
        }

        if (!await bcrypt.compare(String(otp), findOtp.otpCode)) {
            await Otp.updateOne({ _id: findOtp._id }, { $inc: { tries: 1 } })
            return res.status(401).json({ success: false, message: "Invalid or missing otp code" })
        }
        await Otp.deleteOne({ _id: findOtp._id })

        const sessions = await Session.find({ userId: user._id })

        if (sessions && sessions.length > 0) {
            await Session.updateMany(
                { userId: user._id },
                {
                    $set: {
                        revokedBy: 'password_change',
                        revokedAt: Date.now()
                    }
                }
            );
        }
        
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        user.password = hashedPassword
        await user.save()

        res.status(200).json({ success: true, message: "Password changed successfully." })

    } catch (error) {
        logError(error)
        res.status(500).json({ success: false, message: "Internal server error." })
    }
})
const GOOGLE_STATE_COOKIE = 'googleOAuthState';
const GOOGLE_REDIRECT_COOKIE = 'googleOAuthRedirect';

function googleOAuthConfig() {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const baseUrl = (process.env.MAIN_URL || `http://localhost:${process.env.PORT || 3000}`).replace(/\/+$/, '');
    const redirectUri = process.env.GOOGLE_REDIRECT_URL || `${baseUrl}/api/auth/google/callback`;
    return { clientId, clientSecret, redirectUri };
}

function safeInternalPath(value) {
    return typeof value === 'string' && value.startsWith('/') && !value.startsWith('//') ? value : null;
}

function loginRedirect(message, type) {
    return '/login?message=' + encodeURIComponent(message) + '&t=' + (type || 'warning');
}

async function usernameFromEmail(email) {
    const local = String(email).split('@')[0].toLowerCase().replace(/[^a-z0-9_.-]/g, '').replace(/^[-_.]+|[-_.]+$/g, '');
    const base = (local.length >= 3 ? local : `${local}user`).slice(0, 24);
    let candidate = base;
    while (await User.exists({ username: candidate })) {
        candidate = `${base}${crypto.randomInt(1000, 10000)}`.slice(0, 32);
    }
    return candidate;
}

Router.get('/google', (req, res) => {
    try {
        const { clientId, redirectUri } = googleOAuthConfig();
        if (!clientId || !process.env.GOOGLE_CLIENT_SECRET) {
            return res.redirect(loginRedirect('Google sign-in is not configured on this server yet.'));
        }
        const state = crypto.randomBytes(24).toString('base64url');
        res.cookie(GOOGLE_STATE_COOKIE, hashToken(state), {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            path: '/',
            maxAge: 10 * 60 * 1000
        });
        const redirect = safeInternalPath(req.query.redirect);
        if (redirect) {
            res.cookie(GOOGLE_REDIRECT_COOKIE, redirect, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'lax',
                path: '/',
                maxAge: 10 * 60 * 1000
            });
        }
        const params = new URLSearchParams({
            client_id: clientId,
            redirect_uri: redirectUri,
            response_type: 'code',
            scope: 'openid email profile',
            state,
            access_type: 'online',
            prompt: 'select_account'
        });
        res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
    } catch (error) {
        logError(error);
        res.redirect(loginRedirect('Could not start Google sign-in. Please try again.', 'error'));
    }
});

Router.get('/google/callback', async (req, res) => {
    const clearOAuthCookies = () => {
        res.clearCookie(GOOGLE_STATE_COOKIE, { path: '/' });
        res.clearCookie(GOOGLE_REDIRECT_COOKIE, { path: '/' });
    };
    try {
        const { clientId, clientSecret, redirectUri } = googleOAuthConfig();
        const postLoginRedirect = safeInternalPath(req.cookies[GOOGLE_REDIRECT_COOKIE]) || '/dashboard';
        const expectedState = req.cookies[GOOGLE_STATE_COOKIE];
        clearOAuthCookies();

        if (!clientId || !clientSecret) {
            return res.redirect(loginRedirect('Google sign-in is not configured on this server yet.'));
        }
        if (req.query.error) {
            return res.redirect(loginRedirect('Google sign-in was cancelled or denied.'));
        }
        const { code, state } = req.query;
        if (!code || !state || !expectedState || hashToken(String(state)) !== expectedState) {
            return res.redirect(loginRedirect('Invalid Google sign-in state. Please try again.', 'error'));
        }

        const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                code: String(code),
                client_id: clientId,
                client_secret: clientSecret,
                redirect_uri: redirectUri,
                grant_type: 'authorization_code'
            })
        });
        if (!tokenResponse.ok) {
            return res.redirect(loginRedirect('Google sign-in failed while exchanging the code. Please try again.', 'error'));
        }
        const tokens = await tokenResponse.json();

        const profileResponse = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
            headers: { Authorization: `Bearer ${tokens.access_token}` }
        });
        if (!profileResponse.ok) {
            return res.redirect(loginRedirect('Could not read your Google profile. Please try again.', 'error'));
        }
        const googleProfile = await profileResponse.json();
        if (!googleProfile.sub || !googleProfile.email) {
            return res.redirect(loginRedirect('Your Google account did not return an email address.', 'error'));
        }

        const email = String(googleProfile.email).toLowerCase();
        let user;
        const identity = await Identity.findOne({ provider: 'google', providerUserId: String(googleProfile.sub) });
        if (identity) {
            user = await User.findById(identity.userId);
        } else {
            user = await User.findOne({ email });
            if (!user) {
                user = await User.create({
                    username: await usernameFromEmail(email),
                    email,
                    emailVerifiedAt: new Date(),
                    termsAcceptedAt: new Date(),
                    profile: {
                        displayName: googleProfile.name || undefined,
                        avatarUrl: googleProfile.picture || undefined
                    }
                });
            }
            await Identity.create({
                userId: user._id,
                provider: 'google',
                providerUserId: String(googleProfile.sub),
                email,
                displayName: googleProfile.name || undefined
            });
        }

        if (!user || user.status !== 'active') {
            return res.redirect(loginRedirect('This account is not active.', 'error'));
        }
        if (!user.emailVerifiedAt) {
            user.emailVerifiedAt = new Date();
            await user.save();
        }

        await issueSession(user, req, res, 'google');
        res.redirect(postLoginRedirect);
    } catch (error) {
        logError(error);
        res.redirect(loginRedirect('Google sign-in failed. Please try again.', 'error'));
    }
});

Router.get('/:provider', async (req, res) => {
    try {
        const provider = String(req.params.provider || '').toLowerCase();
        const targets = {
            x: process.env.X_REDIRECT_URL,
            apple: process.env.APPLE_REDIRECT_URL
        };
        const target = targets[provider];
        if (target) {
            return res.status(308).redirect(target);
        }
        return res.redirect(loginRedirect('This social provider is not available yet.'));
    } catch (error) {
        logError(error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
})

module.exports = Router;

const Router = require("express").Router();
const bcrypt = require("bcrypt");

const User = require("../models/User");
const App = require("../models/App");
const Session = require("../models/Session");
const Otp = require("../models/Otp");

const { logError } = require("../modules/logs");
const sendEmail = require("../modules/SMTP/send");
const validate = require("../modules/validate");
const { issueSession } = require("../modules/auth/session");

function createOtpAndSend(userId, email) {
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiry = Date.now() + 10 * 60 * 1000;

    return Otp.create({ userId, otp, expiresAt: new Date(otpExpiry) })
        .then(() => {
            console.log(`OTP for user ${userId} is ${otp}. It will expire in 10 minutes.`);
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

Router.post('/login', validate, async (req, res) => {
    try {
        const { email, password } = req.body;

        if(!email || !password){
            return res.status(400).json({ success: false, message: "Email and password are required." });
        }

        const user = await User.findOne({ email });

        if(!user){
            return res.status(401).json({ success: false, message: "Invalid credentials." });
        }

        if(!user.isVerified){
            await Otp.deleteMany({ userId: user._id });
            await createOtpAndSend(user._id, email);

            return res.status(403).json({ success: false, message: "Account not verified. Please verify your account.", verified: false });
        }

        const isPasswordValid = await bcrypt.compare(password, user.password);

        if(!isPasswordValid){
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

        if(!email || !otp){
            return res.status(400).json({ success: false, message: "Email and OTP are required." });
        }

        const user = await User.findOne({ email });

        if(!user){
            return res.status(404).json({ success: false, message: "User not found." });
        }

        const existingOtp = await Otp.findOne({ userId: user._id });

        if(!existingOtp){
            return res.status(404).json({ success: false, message: "OTP not found. Please request a new one." });
        }

        if(existingOtp.expiresAt < new Date()){
            await Otp.deleteOne({ userId: user._id });
            return res.status(400).json({ success: false, message: "OTP has expired. Please request a new one." });
        }

        if(existingOtp.otp !== otp || existingOtp.tries >= existingOtp.maxTries){
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
        
        if(!email){
            return res.status(400).json({ success: false, message: "Email is required." });
        }

        const user = await User.findOne({ email });

        if(!user){
            return res.status(404).json({ success: false, message: "User not found." });
        }

        await Otp.deleteMany({ userId: user._id });
        await createOtpAndSend(user._id, email);

        res.status(200).json({ success: true, message: "OTP sent successfully." });
    
    }catch (error) {
        logError(error);       
        res.status(500).json({ success: false, message: "Internal server error."});
    }
})

Router.post("/signup", async (req, res) => {
    try { 
        const { username, email, password, phone, address, birthday, fullName, bio, profilePicture, banner } = req.body;
        const { appId } = req.body; 

        if(!username || !email || !password){
            return res.status(400).json({ success: false, message: "Required fields are missing." });
        }
        if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){
            return res.status(400).json({ success: false, message: "Invalid email format." });
        }

        const user = await User.findOne({ $or: [{ username }, { email }] })

        if(user){
            return res.status(400).json({ success: false, message: "Username or email already exists."});
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const newUser = new User({
            username,
            email,
            password: hashedPassword,
            phone: phone || "",
            address: address || "",
            birthday: birthday || null,
            fullName: fullName || "",
            bio: bio || "",
            profilePicture: profilePicture || "",
            banner: banner || "",
            app: appId || null
        })

        const savedUser = await newUser.save();

        if(!savedUser){
            return res.status(500).json({ success: false, message: "Failed to create user." });
        }

        await createOtpAndSend(savedUser._id, savedUser.email);

        res.status(201).json({
            success: true,
            message: "Account created. Please check your email for the verification code.",
            email: savedUser.email,
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
        if(!token){
            return res.status(400).json({ success: false, message: "No access token provided." });
        }
        token = crypto.createHash('sha256').update(token).digest('hex');
        
        const session = await Session.findOne({ refreshToken: token });
        if(!session){
            return res.status(400).json({ success: false, message: "Invalid session." });
        }

        session.revoked = true;
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
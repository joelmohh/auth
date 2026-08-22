const Router = require("express").Router();
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");


const User = require("../models/User");
const App = require("../models/App");
const Session = require("../models/Session");
const Otp = require("../models/Otp");

const { logError } = require("../modules/logs");
const sendEmail = require("../modules/SMTP/send");
const validate = require("../modules/validate");

Router.post('/login', validate, async (req, res) => {
    try {
        const { email, username , password } = req.body;

        if(!email && !username || !password){
            return res.status(400).json({ success: false, message: "Email or username and password are required." });
        }

        const user = await User.findOne({ email });

        if(!user){
            return res.status(404).json({ success: false, message: "Invalid credentials." });
        }

        if(!user.isVerified){
            return res.status(403).json({ success: false, message: "Account not verified. Please verify your account.", verified: false });
        }

        const isPasswordValid = await bcrypt.compare(password, user.password);

        if(!isPasswordValid){
            return res.status(400).json({ success: false, message: "Invalid credentials." });
        }

        const accessToken = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: "1h" });
        const refreshToken = crypto.randomBytes(64).toString('hex');

        const session = new Session({
            userId: user._id,
            refreshToken: refreshToken,
            deviceInfo: req.headers['user-agent'] || '',
            ipAddress: req.ip || '',
            type: 'login'
        })

        await session.save();

        res.cookie('refreshToken', refreshToken, { httpOnly: true, secure: true, sameSite: 'Strict', maxAge: 7 * 24 * 60 * 60 * 1000 });
        res.status(200).json({ success: true, message: "Login successful.", accessToken });

    } catch (error) {
        logError(error);
        res.status(500).json({ success: false, message: "Internal server error." });
    }
});

Router.post('/verify-otp', async (req, res) => {
    try {
        const { email, otp } = req.body;

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

        if(existingOtp.otp !== otp){
            return res.status(400).json({ success: false, message: "Invalid OTP." });
        }

        user.isVerified = true;
        user.verificatedAt = new Date();
        await user.save();

        await Otp.deleteOne({ userId: user._id });

        res.status(200).json({ success: true, message: "OTP verified successfully." });

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

        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const otpExpiry = Date.now() + 10 * 60 * 1000; 

        const user = await User.findOne({ email });

        if(!user){
            return res.status(404).json({ success: false, message: "User not found." });
        }

        const existingOtp = await Otp.findOne({ userId: user._id })

        if(existingOtp){
            await Otp.deleteOne({ userId: user._id });
        }

        const newOtp = new Otp({
            userId: user._id,
            otp,
            expiresAt: new Date(otpExpiry)
        })
        await newOtp.save();

        await sendEmail(email, "Your OTP Code", `<p>Your OTP code is: <strong>${otp}</strong></p><p>This code will expire in 10 minutes.</p>`);

        res.status(200).json({ success: true, message: "OTP sent successfully." });
    
    }catch (error) {
        logError(error);       
        res.status(500).json({ success: false, message: "Internal server error.", debug: Date.now() });
    }
})

Router.post("/register", async (req, res) => {
    try { 
        const { username, email, password, phone, address, birthday, fullName, bio, profilePicture, banner } = req.body;

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
            phone,
            address,
            birthday,
            fullName,
            bio,
            profilePicture,
            banner
        })

        const savedUser = await newUser.save();

        if(!savedUser){
            return res.status(500).json({ success: false, message: "Failed to create user." });
        }
        
        const accessToken = jwt.sign({ id: savedUser._id }, process.env.JWT_SECRET, { expiresIn: "1h" });
        const refreshToken = crypto.randomBytes(64).toString('hex');

        const session = new Session({
            userId: savedUser._id,
            refreshToken: refreshToken,
            deviceInfo: req.headers['user-agent'] || '',
            ipAddress: req.ip || '',
            type: 'register'
        })

        await session.save();

        res.cookie('refreshToken', refreshToken, { httpOnly: true, secure: true, sameSite: 'Strict', maxAge: 7 * 24 * 60 * 60 * 1000 });
        res.status(201).json({ success: true, message: "User registered successfully.", accessToken });

    } catch (error) {

        logError(error);
        
        res.status(500).json({ success: false, message: "Internal server error." });

    }
})

module.exports = Router;
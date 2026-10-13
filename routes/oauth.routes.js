const Router = require('express').Router()
const bcrypt = require('bcrypt')
const crypto = require('crypto')

const App = require('../models/App')
const User = require('../models/User')
const Grant = require('../models/Grant')
const Session = require('../models/Session')
const AuthCode = require('../models/AuthCode')

const { logError } = require('../modules/logs') 
const { verifyToken } = require('../modules/auth/session')
const { default: mongoose } = require('mongoose')
const { encrypt, decrypt } = require(`../modules/crypto`)
const { issueSession } = require('../modules/session')

Router.get('/authorize', async (req, res) => {
    try {

        const { client_id, redirect_url, scope } = req.query

        if(!client_id || !redirect_url || !scope){
            return res.status(403).json({success: false, message: "Missing required query params"})
        }

        const app = await App.exists({ clientId: client_id })

        if(!app){
            return res.status(404).json({success: false, message: "App not found, incorrect client_id"})
        }

        if(!app.redirectUrls.includes(redirect_url)){
            return res.status(401).json({success: true, message: "Incorrect redirec_url."})
        }

        res.status(200).render('authorize', { app })

    } catch (error) {
        logError(error)
        res.status(500).json({ success: false, message: "Internal server error."})
    }
})

Router.post(`/authorize`, verifyToken, async(req, res) => {
    try {

        const {appId, scopes} = req.body
        
        if(!appId || !mongoose.isValidObjectId(appId)){
            return res.status(400).json({success: false, message: "Invalid app id on body"})
        }

        const user = await User.exists({_id: req.user.id})

        if(!user){
            return res.status(404).json({ success: false, message:"User not found."})
        }

        const grant = await Grant.insertOne({
            userId: user._id,
            appId,
            scopes,
            lastUsedAt: Date.now()
        })

        if(!grant){
            return res.status(400).json({success: false, message: "Fail to grant authorization."})
        }
        
        const code = crypto.randomBytes(8).toString('hex')
        const codeHash = encrypt(code)

        const auth_code = await AuthCode.insertOne({
            codeHash, 
            appId,
            userId: user._id,
            scopes
        }) 

        if(!auth_code){
            return res.status(400).json({ success: false, message: "Fail to create auth_code, please try again."})
        }

        return res.status(200).json({success: true, message:"Acess authorized successfully.", authorized: true, code: code })

    } catch(error) {
        logError(error)
        res.status(500).json({ success: false, message:"Internal server error."})
    }
})

Router.post('/token', async (req, res) => {
    try {
        
        const { token } = req.body 
        
        if(!token){
            return res.status(400).json({ success: false, message:"Field 'token' is missing."})
        }

        const auth_code = await AuthCode.exists({
            codeHash: encrypt(token)
        })

        if(!auth_code){
            return res.status(404).json({ success: false, message: "Code not found."})
        }

        const user = await User.exists({_id: auth_code.userId})

        if(!user){
            return res.status(404).json({ success: false, message: "User not found."})
        }

        const tokens = await issueSession(user, req, res, 'out', auth_code.appId)

        res.status(200).json({ success: true, message: "Authenticated successfully.", data: tokens.accessToken})

    } catch (error) {
        logError(error)
        res.status(500).json({ success: false, message: "Internal server error."})
    }
})

App.post('/revoke', async (req, res) => {
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

module.exports = Router
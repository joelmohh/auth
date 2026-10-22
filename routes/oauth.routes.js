const Router = require('express').Router()
const crypto = require('crypto')

const App = require('../models/App')
const User = require('../models/User')
const Grant = require('../models/Grant')
const Session = require('../models/Session')
const AuthCode = require('../models/AuthCode')

const { logError } = require('../modules/logs') 
const { verifyToken } = require('../modules/auth/session')
const { default: mongoose } = require('mongoose')
const { issueSession } = require('../modules/auth/session')

Router.get('/authorize', async (req, res) => {
    try {

        const { client_id, redirect_url, scope } = req.query

        if(!client_id || !redirect_url || !scope){
            return res.status(403).json({success: false, message: "Missing required query params"})
        }

        const app = await App.findOne({ clientId: client_id, status: 'active' })

        if(!app){
            return res.status(404).json({success: false, message: "App not found, incorrect client_id"})
        }

        if(!app.redirectUrls?.includes(redirect_url)){
            return res.status(401).json({success: true, message: "Incorrect redirec_url."})
        }

        res.status(200).render('authorize', { app })

    } catch (error) {
        logError(error)
        res.status(500).json({ success: false, message: "Internal server error."})
    }
})

Router.post('/authorize', verifyToken, async(req, res) => {
    try {

        const {appId, scopes} = req.body
        
        if(!appId || !mongoose.isValidObjectId(appId)){
            return res.status(400).json({success: false, message: "Invalid app id on body"})
        }

        const user = await User.findOne({_id: req.user.id, status: 'active'})

        if(!user){
            return res.status(404).json({ success: false, message:"User not found."})
        }

        const app = await App.findOne({ _id: appId, satus: 'active'})

        if(!app){
            return res.status(404).json({ success: false, message: "App not found."})
        }

        const requestedScopes = Array.isArray(scopes) ? scopes : []
        if(requestedScopes.some(scope => !app.scopes.includes(scope))){
            return res.status(400).json({success: false, message: "Requested scope is not enabled for this app"})
        }

        const existingGrant = await Grant.findOne({ userId: user._id, appId})
        
        if(existingGrant?.bannedAt){
            return res.status(403).json({success: false, message: "User banned from this app"})
        }

        const grant = await Grant.findOneAndUpdate(
            { userId: user._id, appId },
            { $set: { scopes: requestedScopes, lastUsedAt: Date.now(), revokedAt: null}},
            { upsert: true, returnDocument: 'after', runValidators: true}
        )

        if(!grant){
            return res.status(400).json({success: false, message: "Fail to grant authorization."})
        }
        
        const code = crypto.randomBytes(8).toString('hex')
        const codeHash = crypto.createHash('sha256').update(code).digest('hex')

        const auth_code = await AuthCode.insertOne({
            codeHash, 
            appId,
            userId: user._id,
            scopes: requestedScopes,
            expiresAt: new Date(Date.now() + 10 * 60 * 1000)
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

        const auth_code = await AuthCode.findOne({
            codeHash: crypto.createHash('sha256').update(token).digest('hex')
        })

        if(!auth_code){
            return res.status(404).json({ success: false, message: "Code not found."})
        }

        if(auth_code.userAt || auth_code.expiresAt <= new Date()){
            return res.status(400).json({ success: false, message: "Code expired or already used."})
        }
        const user = await User.exists({_id: auth_code.userId, status: 'active'})

        if(!user){
            return res.status(404).json({ success: false, message: "User not found."})
        }

        auth_code.usedAt = new Date()
        await auth_code.save()
        const tokens = await issueSession(user, req, res, 'out', auth_code.appId)

        res.status(200).json({ success: true, message: "Authenticated successfully.", data: tokens.accessToken})

    } catch (error) {
        logError(error)
        res.status(500).json({ success: false, message: "Internal server error."})
    }
})

Router.post('/revoke', async (req, res) => {
    try {
        let token = req.cookies['refreshToken'];
        if (!token) {
            return res.status(400).json({ success: false, message: "No refresh token provided." });
        }

        const session = await Session.findOne({ refreshToken: crypto.createHash('sha256').update(token).digest('hex')});
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
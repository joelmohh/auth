const Router = require("express").Router()

const User = require('../models/User')
const Session = require('../models/Session')

const { verifyToken } = require("../modules/auth/session")
const { logError } = require('../modules/logs')
const { default: mongoose } = require("mongoose")

Router.get('/', verifyToken, async (req, res) => {
    try {

        if (!req.user) {
            return res.status(500).json({ success: false, message: "Something went wrong. Please, try again." })
        }

        const user = await User.findOne({ _id: req.user.id })

        if (!user) {
            return res.status(404).json({ success: false, message: "Your session is valid, but we couldn't find your user." })
        }

        const userData = {
            username: user.username,
            email: user.email,
            emailVerified: user.emailVerifiedAt ? true : false,
            profile: user.profile,
            phone: user.phone,
            address: user.address,
            birthDate: user.birthDate,
            accountStatus: user.status
        }

        res.status(200).json({ success: true, message: "User data fetched successfully", data: userData })

    } catch (error) {
        logError(error)
        res.status(500).json({ success: false, message: "Internal server error" })
    }
})

Router.patch('/', verifyToken, async (req, res) => {
    try {

        const {deletedAt, lastLoginAt, termsVersion, termsAcceptedAt, status, ...rest } = req.body

        if (!req.user) {
            return res.status(500).json({ success: false, message: "Something went wrong. Please, try again." })
        }

        if (req.body.password) {
            return res.status(403).json({ success: false, message: "This route can't change password." })
        }
        if (req.body.email) {
            return res.status(403).json({ success: false, message: "Email edit is not supported." })
        }

        const updatedUser = await User.findOneAndUpdate(
            { _id: req.user.id },
            { $set: rest },
            {
                runValidators: true,
                returnDocument: 'after'
            })

        if (!updatedUser) {
            return res.status(404).json({ success: false, message: "User not found." })
        }
        if (updatedUser.status !== 'active') {
            return res.status(403).json({ success: false, message: "Authorization error, account not active" })
        }

        const userData = {
            username: updatedUser.username,
            email: updatedUser.email,
            emailVerified: updatedUser.emailVerifiedAt ? true : false,
            profile: updatedUser.profile,
            phone: updatedUser.phone,
            address: updatedUser.address,
            birthDate: updatedUser.birthDate,
            accountStatus: updatedUser.status
        }

        res.status(200).json({ success: true, message: "User data updated successfully", data: userData })
    } catch (error) {
        logError(error)
        res.status(500).json({ success: false, message: "Internal server error" })
    }
})

Router.delete('/', verifyToken, async (req, res) => {
    try {

        if (!req.user.id) {
            return res.status(400).json({ success: false, message: "Missing required fields" })
        }

        const user = await User.findOne({ _id: req.user.id, status: 'active'})
        if(!user) {
            return res.status(403).json({ success: false, message: 'Authorization error, account not active' })
        }
        await User.findByIdAndUpdate(user._id, {
            status: 'deleted',
            deletedAt: Date.now()
        })

        await Session.updateMany({
            userId: req.user.id
        },
            {
                revokedAt: Date.now(),
                revokedBy: 'system'
            })

        res.status(200).json({ success: true, message: "Account scheduled to deletation successfully." })

    } catch (error) {
        logError(error)
        res.status(500).json({ success: false, message: "Internal server error." })
    }
})

Router.get('/sessions', verifyToken, async (req, res) => {
    try {

        if (!req.user) {
           return res.status(404).json({ success: false, message: "User not found" })
        }
        const user = await User.findById(req.user.id)

        if (!user) {
            return res.status(404).json({ sucess: false, message: "User not found" })
        }
        if (user.status !== 'active') {
            return res.status(403).json({ success: false, message: "Authorization error, account not active" })
        }

        const sessions = await Session.find({ userId: user._id, revokedAt: null }).select('-refreshToken -lastRefreshToken')

        if (!sessions) {
            return res.status(404).json({ sucess: false, message: "No active sessions found" })
        }

        res.status(200).json({ success: true, message: "Sessions fetched successfully", data: sessions })

    } catch (error) {
        logError(error)
        res.status(500).json({ sucess: false, message: "Internal server error" })
    }
})

Router.get('/sessions/:id', verifyToken, async (req, res) => {
    try {

        if (!req.user) {
            return res.status(404).json({ success: false, message: "User not found" })
        }

        const user = await User.findById(req.user.id)

        if (!user) {
            return res.status(404).json({ sucess: false, message: "User not found" })
        }

        if(!mongoose.isValidObjectId(req.params.id)){
            return res.status(400).json({ success: false, message: "Malformed user id"})
        }

        const sessions = await Session.find({ _id: req.params.id, userId: req.user.id }).select('-refreshToken -lastRefreshToken')

        if (sessions.length === 0) {
            return res.status(404).json({ sucess: false, message: "No active found" })
        }

        res.status(200).json({ success: true, message: "Sessions fetched successfully", data: sessions })

    } catch (error) {
        logError(error)
        res.status(500).json({ sucess: false, message: "Internal server error" })
    }
})

/*
TO COMPLETE
Routes.get('/connections', verifyToken, async (req, res) => {
    try {
        if(!req.user){
            return res.status(401).json({success: false, message: "Unauthorized"})
        }

        const user = await User.findById(req.user.id)

        if(!user){
            return res.status(404).json({success: false, message: "User not found"})
        }



    } catch (error) {
        logError(error)
        res.status(500).json({success: false, message: "Internal server error"})
    }
})*/

module.exports = Router
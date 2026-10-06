const Router = require("express").Router()

const User = require('../models/User')
const Session = require('../models/Session')

const { verifyToken } = require("../modules/auth/session")
const { logError } = require('../modules/logs')

Router.get('/', verifyToken, async (req, res) => {
    try {

        if (!req.user) {
            return res.status(500).json({ success: false, message: "Something went wrong. Please, try again." })
        }

        const user = User.findOne({ _id: req.user._id })

        if (!user) {
            return res.status(404).json({ success: false, message: "Your session is valid, but we couldn't find your user." })
        }

        const userData = {
            username: user.username,
            email: user.email,
            emailVerified: emailVerified ? true : false,
            profile: user.profile,
            phone: user.phone,
            adress: user.adress,
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

        const data = req.body

        if (!req.user) {
            return res.status(500).json({ success: false, message: "Something went wrong. Please, try again." })
        }

        const updatedUser = await User.findOneAndUpdate(
            { _id: req.user._id },
            { $set: data },
            {
                new: true,
                runValidators: true
            })

        if (!updatedUser) {
            return res.status(404).json({ success: false, message: "User not found." })
        }

        const userData = {
            username: updatedUser.username,
            email: updatedUser.email,
            emailVerified: updatedUser ? true : false,
            profile: updatedUser.profile,
            phone: updatedUser.phone,
            adress: updatedUser.adress,
            birthDate: updatedUser.birthDate,
            accountStatus: updatedUser.status
        }

        res.status(200).json({ success: false, message: "User data updated successfully", data: userData})
    } catch (error) {
        logError(error)
        res.status(500).json({ success: false, message: "Internal server error" })
    }
})

Router.delete('/', verifyToken, async (req, res) => {
    try {
        if(!req.user){
            return res.status(404).json({success: false, message: "User not found"})
        }

        const user = await User.findOneAndDelete({_id: req.user._id})

        if(!user){
            return res.status(404).json({ success: false, message: "User not found"})
        }

        res.status(204).end()

    } catch (error){
        logError(error)
        res.status(500).json({success: false, message: "Internal server error"})
    }
})

Router.get('/sessions', verifyToken, async (req, res) => {
    try {

        if(!req.user){
            return res.status(404).json({ success: false, message: "User not found"})
        }

        const user = await User.findById(req.user._id)

        if(!user){
            return res.status(404).json({ sucess: false, message: "User not found"})
        }

        const sessions = Session.find({userId: user._id, revokedAt: null})

        if(!sessions){
            return res.status(404).json({ sucess: false, message: "No active sessions found"})
        }
                                                                                            // TRATAR SECAO
        res.status(200).json({ success: true, message: "Sessions fetched successfully", data: sessions})

    } catch (error) {
        logError(error)
        res.status(500).json({ sucess: false, message: "Internal server error"})
    }
})

module.exports = Router
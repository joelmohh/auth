const Router = require('express').Router();
const crypto = require('crypto')

const { verifyToken } = require('../modules/auth/session');
const App = require('../models/App');
const User = require('../models/User');
const { logError } = require('../modules/logs');
const { encrypt, decrypt } = require('../modules/crypto');
const { default: mongoose } = require('mongoose');

Router.get('/', verifyToken, async (req, res) => {
    try {

        if (!req.user) {
            return res.status(401).json({ success: false, message: "Unauthorized" })
        }

        const user = await User.findById(req.user.id)

        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" })
        }

        const apps = await App.find({ ownerId: user._id }).select('ownerId name description clientId redirectUrls scopes providers.provider provider.enabled theme status')

        if (!apps) {
            return res.status(404).json({ success: true, message: "No apps found", data: [] })
        }

        res.status(200).json({ success: true, message: "Data fetched successfully", data: apps })

    } catch (error) {
        logError(error)
        res.status(500).json({ success: false, message: "Internal server error." })
    }
})

Router.post('/', verifyToken, async (req, res) => {
    try {

        if (!req.user) {
            return res.status(401).json({ success: false, message: "Unauthorized" })
        }

        const user = await User.findById(req.user.id)

        if (!user) {
            return res.status(404).json({ success: false, message: "User not found." })
        }

        const { name, description, redirectUrls, scopes, } = req.body

        if (!name) {
            return res.status(403).json({ success: false, message: "Missing required field (name)." })
        }

        const clientId = crypto.randomBytes(16).toString('hex')
        const clientSecret = encrypt(crypto.randomBytes(64).toString('hex'))

        const treatedredirectUrls = []

        const app = await App.create({
            ownerId: user._id,
            name: name,
            description: description || '',
            clientId,
            clientSecret,
            redirectUrls: treatedredirectUrls,
            scopes,
            providers: []
        })

        if (!app) {
            return res.status(418).json({ success: false, message: "Something went wrong." })
        }

        app.clientSecret = decrypt(clientSecret)

        res.status(200).json({ success: true, message: "App created successfully", data: app })

    } catch (error) {
        logError(error)
        res.status(500).json({ success: false, message: "Internal server error." })
    }
})

Router.get('/:id', verifyToken, async (req, res) => {
    try {

        if (!req.user) {
            return res.status(401).json({ success: false, message: "Unauthorized" })
        }

        const app = await App.findById(req.params.id)

        if (!app) {
            return res.status(404).json({ success: false, message: "No apps found", data: [] })
        }

        res.status(200).json({ success: true, message: "Data fetched successfully", data: app })

    } catch (error) {
        logError(error)
        res.status(500).json({ success: false, message: "Internal server errror." })
    }
})

Router.patch('/:id', verifyToken, async (req, res) => {
    try {

        if (!req.user) {
            return res.status(401).json({ success: false, message: "Unauthorized" })
        }

        const user = await User.findById(req.user.id)

        if (!user) {
            return res.status(404).json({ success: false, message: "User not found." })
        }

        const { name, description, redirectUrls, scopes, providers, theme } = req.body

        if (!name) {
            return res.status(403).json({ success: false, message: "Missing required field (name)." })
        }

        const clientId = crypto.randomBytes(16).toString('hex')
        const clientSecret = encrypt(crypto.randomBytes(64).toString('hex'))

        const treatedredirectUrls = []

        redirectUrls.forEach((url) => {
            try {

                const cleanUrl = url.trim()

                const hasProtocol = /^https?:\/\//i.test(cleanUrl);
                const urlToParse = hasProtocol ? cleanUrl : `http://${cleanUrl}`;

                const url = new URL(urlToParse);

                const isValidHost = url.hostname === 'localhost' || url.hostname.includes('.');

                if (isValidHost) {
                    treatedredirectUrls.push(cleanUrl);
                }

            } catch {
                return
            }
        })

        const allowedScopes = ['username', 'email', 'profile', 'phone', 'adress', 'birthDate']
        if (scopes && Array.isArray(scopes)) {
            if (!(scopes.every((scope) => allowedScopes.includes(scope)))) {
                return res.status(403).json({ success: false, message: "Invalid scopes" })
            }
        }

        const app = await App.create({
            ownerId: user._id,
            name: name,
            description: description || '',
            clientId,
            clientSecret,
            redirectUrls: treatedredirectUrls,
            scopes,
            providers: []
        })

        if (!app) {
            return res.status(418).json({ success: false, message: "Something went wrong." })
        }

        app.clientSecret = decrypt(clientSecret)

        res.status(200).json({ success: true, message: "App created successfully", data: app })

    } catch (error) {
        logError(error)
        res.status(500).json({ success: false, message: "Internal server error." })
    }
})

Router.delete('/:id', verifyToken, async (req, res) => {
    try {

        if (!req.user) {
            return res.status(401).json({ success: false, message: "Unauthorized" })
        }

        if (!mongoose.isValidObjectId(req.params.id)) {
            return res.status(403).json({ success: false, message: "Invalid app id provided." })
        }

        const app = await App.findOneAndDelete({ ownerId: req.user.id, _id: req.params.id })

        if (!app) {
            return res.status(404).json({ success: false, message: "No app found", data: [] })
        }

        res.status(200).json({ success: true, message: "App deleted successfully", data: app })

    } catch (error) {
        logError(error)
        res.status(500).json({ success: false, message: "Internal server error." })
    }
})
module.exports = Router;

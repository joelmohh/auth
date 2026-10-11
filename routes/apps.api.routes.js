const Router = require('express').Router();
const crypto = require('crypto')

const { verifyToken } = require('../modules/auth/session');
const App = require('../models/App');
const User = require('../models/User');
const { logError } = require('../modules/logs');
const { encrypt, decrypt } = require('../modules/crypto')

Router.get('/', verifyToken, async (req, res) => {
    try {

        if (!req.user) {
            return res.status(401).json({ success: false, message: "Unauthorized" })
        }

        const user = await User.findById(req.user.id)

        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" })
        }

        const apps = await App.find({ ownerId: user._id }).select('ownerId name description clientId redirectUris scopes providers.provider provider.enabled theme status')

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

        const { name, description, redirectUris, scopes, providers, theme } = req.body

        if (!name) {
            return res.status(403).json({ success: false, message: "Missing required field (name)." })
        }

        const clientId = crypto.randomBytes(16).toString('hex')
        const clientSecret = encrypt(crypto.randomBytes(64).toString('hex'))

        const treatedRedirectUris = []

        redirectUris.forEach((uri) => {
            try {

                const cleanUri = uri.trim()

                const hasProtocol = /^https?:\/\//i.test(cleanUri);
                const urlToParse = hasProtocol ? cleanUri : `http://${cleanUri}`;

                const url = new URL(urlToParse);

                const isValidHost = url.hostname === 'localhost' || url.hostname.includes('.');

                if (isValidHost) {
                    treatedRedirectUris.push(cleanUri);
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
            redirectUris: treatedRedirectUris,
            scopes,
            providers: []
        })

        if (!app) {
            return res.status(418).json({ success: false, message: "Something went wrong." })
        }

        res.status(200).json({ success: true, message: "App created successfully", data: app })

    } catch (error) {
        logError(error)
        res.status(500).json({ success: false, message: "Internal server error." })
    }
})

Router.get('/:id', verifyToken, async (req, res) => {
    try {

        if(!req.user){
            return res.status(401).json({success: false, message: "Unauthorized"})
        }

        const app = await App.findById(req.params.id)

        if(!app){
            return res.status(404).json({ success: false, message: "No apps found", data: []})
        }

        res.status(200).json({ success: true, message: "Data fetched successfully", data: app})

    } catch (error) {
        logError(error)
        res.status(500).json({ success: false, message: "Internal server errror."})
    }
})

Router.patch('/:id', verifyToken, async (req, res) => {
    try {
        // TO CONTINUE NEXT COMMIT
    } catch(error){
        logError(error)
        res.status(500).json({ success: false, message: "Internal server error."})
    }
})
module.exports = Router;

const Router = require('express').Router();
const crypto = require('crypto')

const { verifyToken } = require('../modules/auth/session');
const App = require('../models/App');
const User = require('../models/User');
const Grant = require('../models/Grant');
const Session = require('../models/Session')
const RefreshTokens = require('../models/RefreshTokens')
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

        const { name, description, redirectUrls, scopes } = req.body

        if (!name) {
            return res.status(403).json({ success: false, message: "Missing required field (name)." })
        }

        const clientId = crypto.randomBytes(16).toString('hex')
        const clientSecret = encrypt(crypto.randomBytes(64).toString('hex'))

        if (redirectUrls !== undefined && (!Array.isArray(redirectUrls)) || redirectUrls.some(url => !/^https?:\/\/\S+$/i.test(url))) {
            return res.status(400).json({ success: false, message: "Invalid redirect URLs." })
        }

        const app = await App.create({
            ownerId: user._id,
            name: name,
            description: description || '',
            clientId,
            clientSecret,
            redirectUrls: redirectUrls,
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

        if (!mongoose.isValidObjectId(req.params.id)) {
            return res.status(400).json({ succes: false, message: "Malformed app id." })
        }

        const app = await App.findOne({ _id: req.params.id, ownerId: req.user.id })

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

        const app = await App.findOneAndUpdate(
            { _id: req.params.id, ownerId: user._id },
            { $set: { name, description, redirectUrls, scopes, providers, theme } },
            { returnDocument: 'after', runValidators: true }
        )

        if (!app) {
            return res.status(418).json({ success: false, message: "Something went wrong." })
        }

        res.status(200).json({ success: true, message: "App updated successfully", data: app })

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

        await Promise.all([
            Grant.deleteMany({ appId: app._id }),
            Session.updateMany({ appId: app._id, revokedAt: null }, { $set: { revokedAt: new Date(), revokedBy: 'system' } }),
            RefreshTokens.updateMany({ appId: app._id, revokedAt: null }, { $set: { revokedAt: new Date() } })
        ])

        res.status(200).json({ success: true, message: "App deleted successfully", data: app })

    } catch (error) {
        logError(error)
        res.status(500).json({ success: false, message: "Internal server error." })
    }
})

Router.put('/:id/redirects', verifyToken, async (req, res) => {
    try {

        if (!req.params.id || !mongoose.isValidObjectId(req.params.id)) {
            return res.status(403).json({ success: false, message: "Malformed request url" })
        }
        if (!Array.isArray(req.body.redirectUrls) || req.body.redirectUrls.some(url => !/^https?:\/\/\S+$/i.test(url))) {
            return res.status(403).json({ success: false, message: "Missing required fields." })
        }
        if (!req.body.redirectUrls) {
            return res.status(403).json({ success: false, message: "Missing required fields" })
        }

        const user = await User.findById(req.user.id)

        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" })
        }

        const app = await App.findOneAndUpdate({
            ownerId: user._id, _id: req.params.id
        },
            {
                redirectUrls: req.body.redirectUrls
            })

        if (!app) {
            return res.status(404).json({ success: false, message: "No app found" })
        }
        res.status(200).json({ success: true, message: "Redirect urls updated successfully." })

    } catch (error) {
        logError(error)
        res.status(500).json({ success: false, message: "Internal server error." })
    }
})

Router.put('/:id/scopes', verifyToken, async (req, res) => {
    try {

        if (!req.params.id || !mongoose.isValidObjectId(req.params.id)) {
            return res.status(403).json({ success: false, message: "Malformed request url" })
        }
        if (!req.body.scopes) {
            return res.status(403).json({ success: false, message: "Missing required fields." })
        }

        const app = await App.findOneAndUpdate({ ownerId: req.user.id, _id: req.params.id }, { $set: { scopes: req.body.scopes } }, { returnDocument: 'after' })

        if (!app) {
            return res.status(403).json({ success: false, message: "App not found" })
        }

        res.status(200).json({ success: true, message: "App scopes updated successfully." })

    } catch (error) {
        logError(error)
        res.status(500).json({ success: false, message: "Internal server error." })
    }
})

Router.patch('/:id/appearance', verifyToken, async (req, res) => {
    try {

        if (!req.params.id || !mongoose.isValidObjectId(req.params.id)) {
            return res.status(403).json({ success: false, message: "Malformed request url" })
        }

        const { primaryColor, logoUrl, bannerUrl, darkMode } = req.body

        if (!req.body || Object.keys(req.body).length === 0) {
            return res.status(400).json({ success: false, message: "Body cannot be empty" })
        }

        if (primaryColor !== undefined && !/^#[0-9a-f]{3,8}$/i.test(primaryColor)) {
            return res.status(400).json({ success: false, message: "Invalid primary color." })
        }

        const updateData = {}

        if (primaryColor !== undefined) updateData["theme.primaryColor"] = primaryColor
        if (logoUrl !== undefined) updateData["theme.logoUrl"] = logoUrl
        if (bannerUrl !== undefined) updateData["theme.bannerUrl"] = bannerUrl
        if (darkMode !== undefined) updateData["theme.darkMode"] = darkMode

        if (Object.keys(updateData).length === 0) {
            return res.status(400).json({ success: false, message: "No valid fields provided." })
        }

        const app = await App.findOneAndUpdate(
            {
                ownerId: req.user.id,
                _id: req.params.id
            },
            {
                $set: updateData
            },
            {
                returnDocument: "after"
            })

        if (!app) {
            return res.status(404).json({ success: false, message: "App not found or unauthorized" })
        }

        res.status(200).json({ success: true, message: "App appearance update successfully.", data: app })

    } catch (error) {
        logError(error)
        res.status(500).json({ success: false, message: "Internal server error." })
    }
})

Router.get('/:id/providers', verifyToken, async (req, res) => {
    try {

        if (!req.params.id || !mongoose.isValidObjectId(req.params.id)) {
            return res.status(403).json({ success: false, message: "Malformed request url" })
        }

        const app = await App.findOne({
            ownerId: req.user.id,
            _id: req.params.id
        })

        if (!app) {
            return res.status(404).json({ success: false, message: "App not found" })
        }

        res.status(200).json({ success: true, message: "Data fetched successfully.", data: app.providers })

    } catch (error) {
        logError(error)
        res.status(500).json({ success: false, message: "Internal server error." })
    }
})

Router.put('/:id/providers/:provider', verifyToken, async (req, res) => {
    try {

        if (!req.params.id || !mongoose.isValidObjectId(req.params.id)) {
            return res.status(403).json({ success: false, message: "Malformed request url" })
        }

        if (!req.params.provider || !['x', 'apple', 'google', 'microsoft', 'discord', 'github'].includes(req.params.provider)) {
            return res.status(400).json({ success: false, message: "Missing or invalid provider" })
        }

        const { _id, provider, ...body } = req.body
        const updates = {}
        for (const key in body) {
            updates[`providers.$.${key}`] = key === 'clientSecret' ? encrypt(body[key]) : body[key]
        }

        const existing = await App.findOne({
            ownerId: req.user.id,
            _id: req.params.id
        })
        if (!existing) {
            return res.status(404).json({ success: false, message: "App not found" })
        }
        const providerIndex = existing.providers.findIndex(item => item.provider === req.params.provider)
        const update = providerIndex >= 0
            ? { $set: Object.fromEntries(Object.entries(body).map(([key, value]) => [`providers.${providerIndex}.${key}`, key === 'clientSecret' ? encrypt(value) : value])) }
            : { $push: { providers: { provider: req.params.provider, ...Object.fromEntries(Object.entries(body).map(([key, value]) => [key, key === 'clientSecret' ? encrypt(value) : value])) } } }
        const app = await App.findOneAndUpdate({ _id: existing._id, ownerId: req.user.id }, update, { returnDocument: "after", runValidators: true })

        if (!app) {
            return res.status(404).json({ success: false, message: "App or provider not found" })
        }

        res.status(200).json({ success: true, message: "Provider updated successfully.", data: app })

    } catch (error) {
        logError(error)
        res.status(500).json({ success: false, message: "Internal server error." })
    }
})

Router.post('/:id/secret/rotate', verifyToken, async (req, res) => {
    try {

        if (!req.params.id || !mongoose.isValidObjectId(req.params.id)) {
            return res.status(400).json({ success: false, message: "Malformed request url" })
        }

        const clientSecret = crypto.randomBytes(64).toString('hex')
        const clientSecretEncrypted = encrypt(clientSecret)

        const app = await App.updateOne({
            ownerId: req.user.id,
            _id: req.params.id
        }, {
            $set: {
                clientSecret: clientSecretEncrypted,
                clientSecretLastRotation: Date.now()
            }
        })

        if (app.matchedCount === 0) {
            return res.status(404).json({ success: false, message: "No app found" })
        }

        res.status(200).json({ success: true, message: "Client secret rotated successfully", data: clientSecret })

    } catch (error) {
        logError(error)
        res.status(500).json({ success: false, message: "Internal server error." })
    }
})

const SCOPE_FIELDS = {
    username: ['username'],
    email: ['email', 'emailVerifiedAt'],
    profile: ['profile'],
    phone: ['phone'],
    address: ['address'],
    birthDate: ['birthDate']
}

const FIELDS = Object.values(SCOPE_FIELDS).flat().join(' ')

function pickByScopes(user, scopes) {
    const out = { id: user._id }
    for (const scope of scopes) {
        for (const field of SCOPE_FIELDS[scope] ?? []) {
            if (user[field] !== undefined) out[field] = user[field]
        }
    }
    return out
}

Router.get('/:id/users', verifyToken, async (req, res) => {
    try {

        if (!req.params.id || !mongoose.isValidObjectId(req.params.id)) {
            return res.status(400).json({ success: false, message: "Malformed request url" })
        }

        const app = await App.exists({ _id: req.params.id, ownerId: req.user.id })

        if (!app) {
            return res.status(404).json({ success: false, message: "App not found" })
        }

        const grants = await Grant.find({ appId: req.params.id, revokedAt: null, bannedAt: null })
            .populate({ path: 'userId', select: FIELDS, match: { status: 'active' } })
            .select('userId scopes -_id')
            .lean()

        const data = grants
            .filter(g => g.userId)
            .map(g => ({
                scopes: g.scopes,
                user: pickByScopes(g.userId, g.scopes)
            }))

        if (!data) {
            return res.status(404).json({ success: false, message: "No user found" })
        }

        res.status(200).json({ success: true, message: "Users found successfully", data: data })

    } catch (error) {
        logError(error)
        res.status(500).json({ success: false, message: "Internal server error" })
    }
})

Router.get('/:id/users/:userId', verifyToken, async (req, res) => {
    try {
        if (!mongoose.isValidObjectId(req.params.id) || !mongoose.isValidObjectId(req.params.userId)) {
            return res.status(400).json({ success: false, message: "Malformed request url" })
        }

        const app = await App.exists({ _id: req.params.id, ownerId: req.user.id })
        if (!app) {
            return res.status(404).json({ success: false, message: "App not found" })
        }

        const grant = await Grant.findOne({
            appId: req.params.id,
            userId: req.params.userId,
            revokedAt: null,
            bannedAt: null
        })
            .populate({ path: 'userId', select: FIELDS, match: { status: 'active' } })
            .select('userId scopes -_id')
            .lean()

        if (!grant || !grant.userId) {
            return res.status(404).json({ success: false, message: "No user found" })
        }

        res.status(200).json({ success: true, message: "User found successfully", data: { scopes: grant.scopes, user: pickByScopes(grant.userId, grant.scopes) } })
    } catch (error) {
        logError(error)
        res.status(500).json({ success: false, message: "Internal server error" })
    }
})

Router.delete('/:id/users/:userId', verifyToken, async (req, res) => {
    try {

        if (!mongoose.isValidObjectId(req.params.id) || !mongoose.isValidObjectId(req.params.userId)) {
            return res.status(400).json({ success: false, message: "Malformed request url" })
        }

        const app = await App.exists({ _id: req.params.id, ownerId: req.user.id })
        if (!app) {
            return res.status(404).json({ success: false, message: "App not found" })
        }

        const grant = await Grant.findOneAndDelete({ appId: req.params.id, userId: req.params.userId })

        if (!grant) {
            return res.status(404).json({ success: false, message: "User not found" })
        }

        await Promise.all([
            Session.updateMany({ appId: req.params.id, userId: req.params.userId, revokedAt: null }, { $set: { revokedAt: new Date(), revokedBy: 'system' } }),
            RefreshTokens.updateMany({ appId: req.params.id, userId: req.params.userId, revokedAt: null }, { $set: { revokedAt: new Date() } })
        ])

        res.status(200).json({ success: true, message: "User permission revoked successfully" })

    } catch (error) {
        logError(error)
        res.status(500).json({ success: false, message: "Internal server error" })
    }
})

Router.post('/:id/users/:userId/ban', verifyToken, async (req, res) => {
    try {

        if (!mongoose.isValidObjectId(req.params.id) || !mongoose.isValidObjectId(req.params.userId)) {
            return res.status(400).json({ success: false, message: "Malformed request url" })
        }

        const app = await App.exists({ _id: req.params.id, ownerId: req.user.id })
        if (!app) {
            return res.status(404).json({ success: false, message: "App not found" })
        }

        const grant = await Grant.findOneAndUpdate({
            appId: req.params.id,
            userId: req.params.userId
        },
            {
                $set: {
                    bannedAt: new Date(),
                    revokedAt: new Date()
                }
            },
            {
                returnDocument: 'after'
            })

        if (!grant) {
            return res.status(404).json({ success: false, message: "User not found" })
        }

        await Promise.all([
            Session.updateMany({ appId: req.params.id, userId: req.params.userId, revokedAt: null }, { $set: { revokedAt: new Date(), revokedBy: 'system' } }),
            RefreshTokens.updateMany({ appId: req.params.id, userId: req.params.userId, revokedAt: null }, { $set: { revokedAt: new Date() } })
        ])

        res.status(200).json({ success: true, message: "User banned successfully." })

    } catch (error) {
        logError(error)
        res.status(500).json({ success: false, message: "Internal server error." })
    }
})

module.exports = Router;

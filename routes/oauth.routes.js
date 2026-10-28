const Router = require('express').Router()
const crypto = require('crypto')
const jwt = require('jsonwebtoken')

const App = require('../models/App')
const User = require('../models/User')
const Grant = require('../models/Grant')
const Session = require('../models/Session')
const AuthCode = require('../models/AuthCode')

const { logError } = require('../modules/logs')
const { verifyToken, hashToken, issueAppTokens } = require('../modules/auth/session')
const CODE_TTL = 10 * 60 * 1000


function requestedScopes(value) {
    if (Array.isArray(value)) return value
    if (typeof value === 'string') return value.trim().split(/\s+/).filter(Boolean)
    return []
}

function errorRedirect(res, redirectURL, state, error, desc) {
    const url = new URL(redirectURL)
    url.searchParams.set('error', error)
    if (desc) url.searchParams.set('error_description', desc)
    if (state) url.searchParams.set('state', state)
    return res.redirect(url.toString())
}

async function findClient(clientId, clientSecret) {
    const app = await App.findOne({ clientId, status: 'active' }).select('+clientSecret')
    if (!app || !clientSecret) return null
    try {
        const provided = Buffer.from(hashToken(clientSecret), 'hex')
        const actual = Buffer.from(app.clientSecret, 'hex')

        if (provided.length !== actual.length || !crypto.timingSafeEqual(provided, actual)) return null

        return app
    } catch (error) {
        logError(error)
        return null
    }
}
function verifyPkce(verifier, challenge, method) {
    if (!challenge) return true
    if (!verifier || method !== 'S256') return false
    const calculated = crypto.createHash('sha256').update(verifier).digest('base64url')
    const expected = Buffer.from(challenge)
    const actual = Buffer.from(calculated)
    return expected.length === actual.length && crypto.timingSafeEqual(actual, expected)
}

Router.get('/authorize', async (req, res) => {
    try {

        const { client_id, redirect_uri, response_type, scope, state, code_challenge, code_challenge_method } = req.query

        if (!client_id || !redirect_uri || !scope) {
            return res.status(403).json({ success: false, message: "Missing required query params" })
        }

        const app = await App.findOne({ clientId: client_id, status: 'active' })
        if (!response_type || response_type !== 'code' || !scope || !app) {
            return res.status(app ? 400 : 404).json({ success: false, message: 'Invalid authorization request.' })
        }

        if (!app.redirectUrls?.includes(redirect_uri)) {
            return res.status(400).json({ success: false, message: "Incorrect redirec_url." })
        }
        if (code_challenge && code_challenge_method !== 'S256') {
            return res.status(400).json({ success: false, message: 'Only S256 PKCE is supported.' })
        }

        const scopes = requestedScopes(scope)
        if (!scope.length || scopes.some(item => !app.scopes.includes(item))) {
            return res.status(400).json({ success: false, message: 'Invalid requested scopes.' })
        }


        res.status(200).render('authorize', {
            app,
            client_id,
            redirect_uri,
            scopes,
            state: state || '',
            code_challenge: code_challenge || '',
            code_challenge_method: code_challenge_method || '',
        })

    } catch (error) {
        logError(error)
        res.status(500).json({ success: false, message: "Internal server error." })
    }
})

Router.post('/authorize', require('../modules/auth/session').verifyPortalToken, async (req, res) => {
    try {

        const { client_id, redirect_uri, scope, state, code_challenge, code_challenge_method, decision } = req.body

        const app = await App.findOne({ clientId: client_id, status: 'active' })
        if (!app || !redirect_uri || !app.redirectUrls?.includes(redirect_uri)) {
            return res.status(400).json({ success: false, message: 'Invalid authorization request.' })
        }
        const scopes = requestedScopes(scope)
        if (!scopes.length || scopes.some(item => !app.scopes.includes(item))) {
            return errorRedirect(res, redirect_uri, state, 'invalid_scope', 'Requested scope is not enabled.')
        }
        if (decision === 'deny') {
            return errorRedirect(res, redirect_uri, state, 'access_denied', 'The user denied the request.')
        }
        if (code_challenge_method && code_challenge_method !== 'S256') {
            return errorRedirect(res, redirect_uri, state, 'invalid_request', 'Only S256 PKCE is supported.')
        }
        const user = await User.findOne({ _id: req.user.id, status: 'active' })
        if (!user) return res.status(404).json({ success: false, message: 'User not found.' })
        const existingGrant = await Grant.findOne({ userId: user._id, appId: app._id })
        if (existingGrant?.bannedAt) return errorRedirect(res, redirect_uri, state, 'access_denied', 'Access to this app is blocked.')
        const grant = await Grant.findOneAndUpdate(
            { userId: user._id, appId: app._id },
            { $set: { scopes, lastUsedAt: new Date(), revokedAt: null }, $setOnInsert: { bannedAt: null } },
            { upsert: true, new: true, runValidators: true }
        )
        const code = crypto.randomBytes(32).toString('base64url')
        await AuthCode.create({
            codeHash: hashToken(code),
            appId: app._id,
            userId: user._id,
            redirectUri: redirect_uri,
            scopes,
            state: state || undefined,
            codeChallenge: code_challenge || undefined,
            codeChallengeMethod: code_challenge_method ? code_challenge_method : undefined,
            expiresAt: new Date(Date.now() + CODE_TTL)
        })
        const redirect = new URL(redirect_uri)
        redirect.searchParams.set('code', code)
        if (state) redirect.searchParams.set('state', state)
        return res.redirect(redirect.toString())
    } catch (error) {
        logError(error)
        res.status(500).json({ success: false, message: 'Internal server error.' })
    }
})


Router.post('/token', async (req, res) => {
    try {
        const {
            grant_type: grantType,
            code,
            client_id: clientId,
            client_secret: clientSecret,
            redirect_uri: redirectUri,
            code_verifier: codeVerifier,
            refresh_token: refreshToken
        } = req.body
        if (!grantType || !clientId || !clientSecret) {
            return res.status(400).json({ error: 'invalid_request', error_description: 'grant_type, client_id and client_secret are required.' })
        }
        const app = await findClient(clientId, clientSecret)
        if (!app) return res.status(401).json({ error: 'invalid_client' })

        if (grantType === 'authorization_code') {
            if (!code || !redirectUri) return res.status(400).json({ error: 'invalid_request' })
            const pkceChallenge = codeVerifier
                ? crypto.createHash('sha256').update(codeVerifier).digest('base64url')
                : null
            const authCode = await AuthCode.findOneAndUpdate(
                {
                    codeHash: hashToken(code),
                    appId: app._id,
                    redirectUri,
                    usedAt: null,
                    expiresAt: { $gt: new Date() },
                    $or: [{ codeChallenge: null }, { codeChallenge: pkceChallenge }]
                },
                { $set: { usedAt: new Date() } },
                { new: true }
            )
            if (!authCode || !verifyPkce(codeVerifier, authCode.codeChallenge, authCode.codeChallengeMethod)) {
                return res.status(400).json({ error: 'invalid_grant' })
            }
            const user = await User.findOne({ _id: authCode.userId, status: 'active' })
            const grant = await Grant.findOne({ userId: authCode.userId, appId: app._id, revokedAt: null, bannedAt: null })
            if (!user || !grant) return res.status(400).json({ error: 'invalid_grant' })
            const tokens = await issueAppTokens(user, req, app._id, grant)
            return res.json({ access_token: tokens.accessToken, token_type: 'Bearer', expires_in: 3600, refresh_token: tokens.refreshToken, scope: authCode.scopes.join(' ') })
        }

        if (grantType === 'refresh_token') {
            if (!refreshToken) return res.status(400).json({ error: 'invalid_request' })
            const current = await RefreshTokens.findOneAndUpdate(
                { refreshToken: hashToken(refreshToken), appId: app._id, revokedAt: null, expiresAt: { $gt: new Date() } },
                { $set: { revokedAt: new Date() } },
                { new: true }
            )
            if (!current) {
                const reused = await RefreshTokens.findOne({ refreshToken: hashToken(refreshToken), appId: app._id })
                if (reused?.revokedAt) {
                    await RefreshTokens.updateMany(
                        { grantId: reused.grantId, appId: app._id, revokedAt: null },
                        { $set: { revokedAt: new Date() } }
                    )
                    await Session.updateMany(
                        { appId: app._id, userId: reused.userId, revokedAt: null },
                        { $set: { revokedAt: new Date(), revokedBy: 'reuse_detected' } }
                    )
                }
                return res.status(400).json({ error: 'invalid_grant' })
            }
            await Session.updateOne(
                { appId: app._id, userId: current.userId, refreshToken: hashToken(refreshToken), revokedAt: null },
                { $set: { revokedAt: new Date(), revokedBy: 'system' } }
            )
            const grant = await Grant.findOne({ _id: current.grantId, appId: app._id, userId: current.userId, revokedAt: null, bannedAt: null })
            const user = await User.findOne({ _id: current.userId, status: 'active' })
            if (!grant || !user) return res.status(400).json({ error: 'invalid_grant' })
            const tokens = await issueAppTokens(user, req, app._id, grant, current._id)
            return res.json({ access_token: tokens.accessToken, token_type: 'Bearer', expires_in: 3600, refresh_token: tokens.refreshToken, scope: current.scopes.join(' ') })
        }
        return res.status(400).json({ error: 'unsupported_grant_type' })
    } catch (error) {
        logError(error)
        res.status(500).json({ error: 'server_error' })
    }
})

Router.get('/userinfo', verifyToken, async (req, res) => {
    try {
        if (!req.session.appId || !req.grant) return res.status(403).json({ error: 'invalid_token' })
        const user = await User.findById(req.user.id).select('_id username email emailVerifiedAt profile phone address birthDate')
        const result = { sub: String(user._id) }
        const fields = {
            username: ['username'],
            email: ['email', 'emailVerifiedAt'],
            profile: ['profile'],
            phone: ['phone'],
            address: ['address'],
            birthDate: ['birthDate']
        }
        for (const scope of req.grant.scopes) for (const field of fields[scope] || []) if (user[field] !== undefined) result[field] = user[field]
        res.json(result)
    } catch (error) {
        logError(error)
        res.status(500).json({ error: 'server_error' })
    }
})

Router.post('/revoke', async (req, res) => {
    try {
        const { token, token_type_hint: hint, client_id: clientId, client_secret: clientSecret } = req.body
        if (!token || !clientId || !clientSecret) return res.status(400).json({ error: 'invalid_request' })
        const app = await findClient(clientId, clientSecret)
        if (!app) return res.status(401).json({ error: 'invalid_client' })
        const hash = hashToken(token)
        const refresh = await RefreshTokens.findOneAndUpdate({ refreshToken: hash, appId: app._id, revokedAt: null }, { $set: { revokedAt: new Date() } }, { new: true })
        if (refresh) {
            await Session.updateMany({ appId: app._id, userId: refresh.userId, refreshToken: hash }, { $set: { revokedAt: new Date(), revokedBy: 'user' } })
        } else if (hint === 'access_token' || !hint) {
            try {
                const decoded = jwt.verify(token, process.env.JWT_SECRET)
                if (decoded.appId === String(app._id)) await Session.updateOne({ _id: decoded.sessionId, appId: app._id }, { $set: { revokedAt: new Date(), revokedBy: 'user' } })
            } catch (error) {
                if (error.name !== 'JsonWebTokenError' && error.name !== 'TokenExpiredError') throw error
            }
        }
        res.status(200).json({})
    } catch (error) {
        logError(error)
        res.status(500).json({ error: 'server_error' })
    }
})
module.exports = Router
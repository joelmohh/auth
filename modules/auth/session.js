const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const Session = require('../../models/Session');
const User = require('../../models/User');
const { logError } = require('../logs');
const fs = require('fs')

function hashToken(token) {
    return crypto.createHash('sha256').update(token).digest('hex');
}

async function verifyToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ success: false, message: 'Access token is missing.' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        if (!decoded.sessionId || !decoded.id) {
            return res.status(403).json({ success: false, message: 'Invalid session token.' });
        }

        const session = await Session.findOne({
            _id: decoded.sessionId,
            userId: decoded.id,
            revokedAt: null,
            expiresAt: { $gt: new Date() }
        });
        if (!session) {
            return res.status(403).json({ success: false, message: 'Session not found or revoked.' });
        }

        const user = await User.findById(decoded.id)

        if (!user) {
            return res.status(404).json({ success: false, message: "Invalid user" })
        }

        if (user.status !== 'active') {
            return res.status(401).json({ success: false, message: "Unactive account" })
        }

        req.user = decoded;
        req.session = session;
        next()
    } catch (error) {

        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({
                success: false,
                message: "Your session has expired. Please request new credentials."
            });
        }

        logError(error);
        return res.status(403).json({ success: false, message: 'Invalid or expired access token.' });
    }
}

async function verifyRefreshToken(req, res, next) {
    const refreshToken = req.cookies.refreshToken;

    if (!refreshToken) {
        return res.status(401).json({ success: false, message: 'Refresh token is missing.' });
    }

    try {
        const refreshTokenHash = hashToken(refreshToken);
        const session = await Session.findOne({ refreshToken: refreshTokenHash, revokedAt: null });

        if (!session || session.expiresAt < new Date()) {
            return res.status(403).json({ success: false, message: 'Invalid refresh token.' });
        }

        req.session = session;
        next();
    } catch (error) {
        logError(error);
        return res.status(500).json({ success: false, message: 'Internal server error.' });
    }
}

function signAccessToken(userId, sessionId) {
    return jwt.sign({ id: userId, sessionId }, process.env.JWT_SECRET, { expiresIn: "1h" });
}

function setRefreshCookie(res, refreshToken) {
    res.cookie('refreshToken', refreshToken, {
        /* httpOnly: false,
         secure: true,
         sameSite: 'Strict',
         path: '/api/auth', */
        maxAge: 7 * 24 * 60 * 60 * 1000
    })
}

async function issueSession(user, req, res, type = 'default', appId = null) {
    const refreshToken = crypto.randomBytes(64).toString('hex')

    const session = await Session.create({
        userId: user._id,
        refreshToken: hashToken(refreshToken),
        userAgent: req.headers['user-agent'] || '',
        ip: req.headers['cf-connectiong-ip'] || req.ip || 'unknown',
        type,
        appId
    })
    await User.findOneAndUpdate({ _id: user._id }, { lastLoginAt: Date.now() })

    setRefreshCookie(res, refreshToken)
    return { accessToken: signAccessToken(user._id, session.id), refreshToken: refreshToken }
}

async function notLoggedIn(req, res, next) {
    if (req.cookies.refreshToken) {

        const session = await Session.exists({ refreshToken: hashToken(req.cookies.refreshToken) })

        if (session) {
            return res.redirect('/dashboard')
        }
        next()
    } else {
        next()
    }
}
async function loggedIn(req, res, next) {
    if (!req.cookies.refreshToken) {
        return res.redirect('/')
    } else {
        next()
    }
}

module.exports = { hashToken, verifyToken, notLoggedIn, loggedIn, verifyRefreshToken, issueSession, setRefreshCookie, signAccessToken };
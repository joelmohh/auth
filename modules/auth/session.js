const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const Session = require('../../models/Session');
const { logError } = require('../logs');

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
            revoked: false,
            expiresAt: { $gt: new Date() }
        });

        if (!session) {
            return res.status(403).json({ success: false, message: 'Session not found or revoked.' });
        }

        req.user = decoded;
        req.session = session;
        next();
    } catch (error) {
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
        const session = await Session.findOne({ refreshToken: refreshTokenHash, revoked: false });

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

function setRefreshCookie(res, refreshToken){
    res.cookie('refreshToken', refreshToken, {
        httpOnly: true,
        secure: true,
        sameSite: 'Strict',
        path: '/api/auth',
        maxAge: 7 * 24 * 60 * 60 * 1000
    })
}

async function issueSession(user, req, res, type){
    const refreshToken = crypto.randomBytes(64).toString('hex')

    const session = await Session.create({
        userId: user._id,
        refreshToken: hashToken(refreshToken),
        userAgent: req.headers['user-agent'] || '',
        ip: req.headers['cf-connectiong-ip'] || req.ip || 'unknown',
        type
    })
}

module.exports = { hashToken, verifyToken, verifyRefreshToken, issueSession };
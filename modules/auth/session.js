const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const Session = require('../../models/Session');
const { logError } = require('../logs');

async function verifyToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ success: false, message: 'Access token is missing.' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
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
        const session = await Session.findOne({ refreshToken });

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
async function requireAuth(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ success: false, message: 'Access token is missing.' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
    } catch (error) {
        logError(error);
        return res.status(403).json({ success: false, message: 'Invalid or expired access token.' });
    }
}
async function issueSession(user, req, res, type) {
    const accessToken = jwt.sign({ id: user._id, appId: 1 /*TODO user.appId*/ }, process.env.JWT_SECRET, { expiresIn: "1h" });
    const refreshToken = crypto.randomBytes(64).toString('hex');

    await Session.create({
        userId: user._id,
        refreshToken,
        deviceInfo: req.headers['user-agent'] || '',
        ipAddress: req.ip || '',
        type
    });

    res.cookie('refreshToken', refreshToken, { httpOnly: true, secure: true, sameSite: 'Strict', maxAge: 7 * 24 * 60 * 60 * 1000 });
    return accessToken;
}


module.exports = { verifyToken, verifyRefreshToken, requireAuth, issueSession };
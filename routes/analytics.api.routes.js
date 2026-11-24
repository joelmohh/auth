const Router = require('express').Router();
const mongoose = require('mongoose');
const App = require('../models/App');
const RefreshTokens = require('../models/RefreshTokens');
const { verifyPortalToken } = require('../modules/auth/session');
const { logError } = require('../modules/logs');

Router.get('/', verifyPortalToken, async (req, res) => {
    res.set('Cache-Control', 'no-store');
    try {
        const days = Number(req.query.days || 7);
        if (![7, 30].includes(days)) return res.status(400).json({ success: false, message: 'Choose 7 or 30 days.' });
        const now = new Date();
        const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - days + 1));
        const apps = await App.find({ ownerId: req.user.id }).select('_id').lean();
        const rows = await RefreshTokens.aggregate([
            { $match: { appId: { $in: apps.map(app => new mongoose.Types.ObjectId(String(app._id))) }, rotatedFrom: null, createdAt: { $gte: start, $lte: now } } },
            { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: 'UTC' } }, count: { $sum: 1 } } }
        ]);
        const counts = new Map(rows.map(row => [row._id, row.count]));
        const series = Array.from({ length: days }, (_, index) => {
            const date = new Date(start.getTime() + index * 86400000).toISOString().slice(0, 10);
            return { date, count: counts.get(date) || 0 };
        });
        res.json({ success: true, data: { days, timezone: 'UTC', metric: 'retained_initial_oauth_token_issues', retentionLimited: true, series, total: series.reduce((sum, day) => sum + day.count, 0) } });
    } catch (error) {
        logError(error);
        res.status(500).json({ success: false, message: 'Could not load activity.' });
    }
});
module.exports = Router;

const App = require('../../models/App');
const User = require('../../models/User');
const Session = require('../../models/Session');
const Grant = require('../../models/Grant');
const RefreshTokens = require('../../models/RefreshTokens');
const { hashToken } = require('../auth/session');
const mongoose = require('mongoose');

const appFields = 'name description clientId redirectUrls scopes providers.provider providers.enabled theme status createdAt';
const scopeFields = { username: ['username'], email: ['email', 'emailVerifiedAt'], profile: ['profile'], phone: ['phone'], address: ['address'], birthDate: ['birthDate'] };

function deviceLabel(agent = '') {
    const os = /iPad/.test(agent) ? 'iPadOS' : /iPhone/.test(agent) ? 'iOS' : /Android/.test(agent) ? 'Android' : /Windows/.test(agent) ? 'Windows' : /Macintosh|Mac OS/.test(agent) ? 'macOS' : /Linux/.test(agent) ? 'Linux' : 'Unknown device';
    const browser = /Edg/.test(agent) ? 'Edge' : /OPR/.test(agent) ? 'Opera' : /Firefox|FxiOS/.test(agent) ? 'Firefox' : /Chrome|CriOS/.test(agent) ? 'Chrome' : /Safari/.test(agent) ? 'Safari' : 'Unknown browser';
    return `${browser} on ${os}`;
}

function imageUrl(value) {
    if (!value || typeof value !== 'string') return '';
    try { const url = new URL(value); return url.protocol === 'https:' ? url.href : ''; } catch { return ''; }
}

function helpers() {
    return {
        imageUrl,
        initials: value => (value || '?').trim().slice(0, 2).toUpperCase(),
        fmtDate: value => value ? new Date(value).toLocaleDateString('en-CA', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' }) : '–',
        deviceLabel,
        json: value => JSON.stringify(value).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029')
    };
}

async function load(req) {
    const session = await Session.findOne({ refreshToken: hashToken(req.cookies.refreshToken), revokedAt: null, expiresAt: { $gt: new Date() }, appId: null }).select('userId').lean();
    if (!session) return null;
    const user = await User.findById(session.userId).select('username email emailVerifiedAt profile phone birthDate status').lean();
    if (!user || user.status !== 'active') return null;
    const apps = await App.find({ ownerId: user._id }).select(appFields).lean();
    const selectedApp = req.params.id && mongoose.isValidObjectId(req.params.id) ? apps.find(app => String(app._id) === req.params.id) : null;
    if (req.params.id && !selectedApp) return { notFound: true };
    const data = { user: { username: user.username, email: user.email, emailVerified: Boolean(user.emailVerifiedAt), profile: user.profile, phone: user.phone, birthDate: user.birthDate }, apps, selectedApp, users: [], sessions: [], authorizations: [], analytics: null };
    if (req.path.endsWith('/users') && selectedApp) {
        const grants = await Grant.find({ appId: selectedApp._id, $or: [{revokedAt:null},{bannedAt:{$ne:null}}] }).populate({ path: 'userId', select: Object.values(scopeFields).flat().join(' '), match: { status: 'active' } }).select('userId scopes bannedAt bannedUntil').lean();
        data.users = grants.filter(grant => grant.userId).map(grant => {
            const person = { id: grant.userId._id };
            for (const scope of grant.scopes || []) for (const field of scopeFields[scope] || []) if (grant.userId[field] !== undefined) person[field] = grant.userId[field];
            return { user: person, scopes: grant.scopes, banned: Grant.banIsActive(grant), bannedUntil: grant.bannedUntil };
        });
    }
    if (req.path === '/dashboard/account') {
        data.sessions = await Session.find({ userId: user._id, revokedAt: null, appId: null }).select('_id userAgent createdAt').lean();
        const grants = await Grant.find({ userId: user._id, revokedAt: null, bannedAt: null }).select('appId scopes lastUsedAt').lean();
        const authorized = await App.find({ _id: { $in: grants.map(grant => grant.appId) } }).select('name').lean();
        data.authorizations = grants.map(grant => ({ appId: grant.appId, scopes: grant.scopes, app: authorized.find(app => String(app._id) === String(grant.appId)) }));
    }
    if (req.path === '/dashboard') {
        const now = new Date();
        const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 6));
        const rows = await RefreshTokens.aggregate([
            { $match: { appId: { $in: apps.map(app => app._id) }, rotatedFrom: null, createdAt: { $gte: start, $lte: now } } },
            { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: 'UTC' } }, count: { $sum: 1 } } }
        ]);
        const counts = new Map(rows.map(row => [row._id, row.count]));
        const series = Array.from({ length: 7 }, (_, index) => { const date = new Date(start.getTime() + index * 86400000).toISOString().slice(0, 10); return { date, count: counts.get(date) || 0 }; });
        data.analytics = { series, total: series.reduce((sum, day) => sum + day.count, 0), retentionLimited: true };
    }
    return JSON.parse(JSON.stringify(data));
}

module.exports = { load, helpers };

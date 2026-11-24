const Router = require('express').Router();
const express = require('express');
const crypto = require('crypto');
const sharp = require('sharp');
const mongoose = require('mongoose');
const App = require('../models/App');
const User = require('../models/User');
const ImageAsset = require('../models/ImageAsset');
const { verifyPortalToken } = require('../modules/auth/session');

Router.post('/:target', verifyPortalToken, express.raw({ type: ['image/png', 'image/jpeg', 'image/webp'], limit: '5mb' }), async (req, res) => {
    res.set('Cache-Control', 'no-store');
    try {
        const field = req.query.field;
        const appTarget = req.params.target === 'app';
        if (!['app', 'account'].includes(req.params.target) || !(appTarget ? ['logoUrl', 'bannerUrl'] : ['avatarUrl', 'bannerUrl']).includes(field)) return res.status(400).json({ success: false, message: 'Choose a supported image field.' });
        const filter = appTarget ? { _id: req.query.appId, ownerId: req.user.id } : { _id: req.user.id };
        if (appTarget && !mongoose.isValidObjectId(req.query.appId)) return res.status(400).json({ success: false, message: 'Invalid application.' });
        const model = appTarget ? App : User;
        if (!await model.exists(filter)) return res.status(404).json({ success: false, message: 'Image owner not found.' });
        if (!process.env.SQUARECLOUD_API_KEY) return res.status(503).json({ success: false, message: 'Image storage is not configured. Set SQUARECLOUD_API_KEY on the server, or use an HTTPS image URL.' });
        if (!Buffer.isBuffer(req.body) || req.body.length < 512) return res.status(400).json({ success: false, message: 'Choose a PNG, JPEG or WebP image between 512 bytes and 5 MB.' });
        let bytes;
        try {
            const image = sharp(req.body, { limitInputPixels: 16000000, animated: false });
            const info = await image.metadata();
            if (!['png', 'jpeg', 'webp'].includes(info.format) || info.width < 16 || info.height < 16 || (info.pages || 1) > 1) throw new Error('Unsupported image');
            bytes = await image.rotate().resize({ width: 2048, height: 2048, fit: 'inside', withoutEnlargement: true }).png({ compressionLevel: 6 }).toBuffer();
            if (bytes.length < 512) bytes = await sharp(bytes).png({ compressionLevel: 0 }).toBuffer();
        } catch { return res.status(400).json({ success: false, message: 'The image could not be decoded. Use a still PNG, JPEG or WebP, at least 16×16 pixels and at most 16 megapixels.' }); }
        const name = `${field}-${crypto.randomUUID()}`;
        const prefix = `auth/${appTarget ? 'apps' : 'accounts'}/${appTarget ? req.query.appId : req.user.id}`;
        const params = new URLSearchParams({ name, prefix, private: 'false', security_hash: 'true', overwrite: 'false' });
        const form = new FormData();
        form.append('file', new Blob([bytes], { type: 'image/png' }), `${name}.png`);
        const response = await fetch(`https://blob.squarecloud.app/v1/objects?${params}`, { method: 'POST', headers: { Authorization: process.env.SQUARECLOUD_API_KEY }, body: form, signal: AbortSignal.timeout(30000) });
        const result = await response.json().catch(() => ({}));
        if (!response.ok || result.status !== 'success') {
            const messages = { STORAGE_QUOTA_EXCEEDED: 'Image storage quota reached.', RATE_LIMITED: 'Storage is busy. Wait before uploading again.', TOO_MANY_CONCURRENT_UPLOADS: 'Too many uploads. Wait before trying again.', ACCESS_DENIED: 'Storage credential was rejected.', MISSING_SCOPE: 'Storage key needs blob:write permission.', RESOURCE_NOT_ALLOWED: 'Storage key cannot be restricted to specific applications.', PERMISSION_DENIED: 'An active Square Cloud Blob plan is required.' };
            return res.status(response.status === 429 ? 429 : 502).json({ success: false, message: messages[result.code] || 'Square Cloud could not store the image. Try again later.' });
        }
        const object = result.response;
        let url;
        try { url = new URL(object.url); } catch { return res.status(502).json({ success: false, message: 'Storage returned no image URL.' }); }
        if (url.protocol !== 'https:' || url.hostname !== 'blob.squarecloud.dev' || !url.pathname.startsWith('/pub/')) return res.status(502).json({ success: false, message: 'Storage returned an invalid image URL.' });
        if (typeof object.id !== 'string' || !object.id.startsWith('pub/')) return res.status(502).json({ success: false, message: 'Storage returned an invalid object identifier.' });
        await ImageAsset.create({ ownerId: req.user.id, appId: appTarget ? req.query.appId : null, field, objectId: object.id, url: url.href, size: bytes.length });
        const updated = await model.updateOne(filter, { $set: { [`${appTarget ? 'theme' : 'profile'}.${field}`]: url.href } });
        if (!updated.matchedCount) return res.status(409).json({ success: false, message: 'Image uploaded but its owner changed. Reload before trying again.' });
        res.json({ success: true, message: 'Image uploaded and saved.', data: { url: url.href, id: object.id, field } });
    } catch (error) {
        res.status(502).json({ success: false, message: error.name === 'TimeoutError' ? 'Image storage timed out. Reload to check the current image before retrying.' : 'Could not save the uploaded image. Reload before retrying.' });
    }
});

module.exports = Router;

const mongoose = require('mongoose');
const schema = new mongoose.Schema({
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    appId: { type: mongoose.Schema.Types.ObjectId, ref: 'App', default: null },
    field: { type: String, enum: ['logoUrl', 'avatarUrl', 'bannerUrl'], required: true },
    objectId: { type: String, required: true, unique: true },
    url: { type: String, required: true },
    size: Number
}, { timestamps: true });
module.exports = mongoose.model('ImageAsset', schema);

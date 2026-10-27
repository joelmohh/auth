const mongoose = require("mongoose")
const RefreshTokens = new mongoose.Schema({
    refreshToken: {
        type: String,
        required: true,
        unique: true
    },
    grantId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Grant',
        required: true
    },
    appId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'App',
        required: true
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    scopes: [String],
    rotatedFrom:{
        type: mongoose.Schema.Types.ObjectId, 
        ref:"refreshTokens",
        default: null
    },
    revokedAt: Date,
    expiresAt: {
        type: Date,
        required: true,
        index: { expires: 0 }
    },
}, { timestamps: true });

module.exports = mongoose.model("refreshTokens", RefreshTokens)
const mongoose = require("mongoose")
const AuthCodeSchema = new mongoose.Schema({
    codeHash: {
        type: String,
        required: true,
        unique: true
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
    redirectUri: {
        type: String,
        required: true
    },
    scopes: [String],
    state: String,
    codeChallenge: String,
    codeChallengeMethod: {
        type: String, 
        enum: ['S256']
    },
    usedAt: {
        type: Date, 
        default: null
    },
    expiresAt: {
        type: Date,
        required: true,
        index: { expires: 0 }
    },
}, { timestamps: true });

module.exports = mongoose.model("AuthCode", AuthCodeSchema)
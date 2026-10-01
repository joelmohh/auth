const mongoose = require("mongoose")
const AuthCodeSchema = new Schema({
    codeHash: {
        type: String,
        required: true,
        unique: true
    },
    appId: {
        type: ObjectId,
        ref: 'App',
        required: true
    },
    userId: {
        type: ObjectId,
        ref: 'User',
        required: true
    },
    redirectUri: {
        type: String,
        required: true
    },
    scopes: [String],
    codeChallenge: String,
    codeChallengeMethod: {
        type: String,
        enum: ['S256']
    },
    usedAt: Date,
    expiresAt: {
        type: Date,
        required: true,
        index: { expires: 0 }
    },
}, { timestamps: true });

module.exports = mongoose.model("AuthCode", AuthCodeSchema)
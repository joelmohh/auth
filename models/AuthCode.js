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
    scopes: [String],
    codeChallenge: String,
    usedAt: Date,
    expiresAt: {
        type: Date,
        required: true,
        index: { expires: 0 }
    },
}, { timestamps: true });

module.exports = mongoose.model("AuthCode", AuthCodeSchema)
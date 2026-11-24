const mongoose = require('mongoose');
const schema = new mongoose.Schema({
    tokenHash: { type: String, required: true, unique: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    sessionId: mongoose.Schema.Types.ObjectId,
    kind: { type: String, required: true },
    challenge: String,
    encryptedSecret: { type: String, select: false },
    expiresAt: { type: Date, required: true, expires: 0 },
    attempts: { type: Number, default: 0 },
    usedAt: { type: Date, default: null },
    redirect: String
}, { timestamps: true });
module.exports = mongoose.model('SecurityChallenge', schema);

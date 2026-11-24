const mongoose = require('mongoose');
const schema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    passkeys: [{ credentialId: String, publicKey: String, counter: Number, transports: [String], name: String, createdAt: Date }],
    totp: { enabled: { type: Boolean, default: false }, encryptedSecret: { type: String, select: false }, lastStep: { type: Number, default: -1 }, recoveryHashes: { type: [String], select: false } }
}, { timestamps: true });
schema.index({ 'passkeys.credentialId': 1 }, { unique: true, sparse: true });
module.exports = mongoose.model('Security', schema);

const mongoose = require("mongoose")
const GrantSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    appId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'App',
        required: true
    },
    scopes:[{type:String}],
    lastUsedAt: Date,
    revokedAt: Date,
    bannedAt: Date,
    bannedUntil: Date
}, {timestamps: true})
GrantSchema.index({ userId: 1, appId: 1 }, { unique: true })
GrantSchema.index({ appId: 1 })

function notBannedFilter() {
    return { $or: [{ bannedAt: null }, { bannedUntil: { $lte: new Date() } }] }
}

function banIsActive(grant) {
    return Boolean(grant?.bannedAt && (!grant.bannedUntil || grant.bannedUntil > new Date()))
}

module.exports = mongoose.model("Grant", GrantSchema)
module.exports.notBannedFilter = notBannedFilter
module.exports.banIsActive = banIsActive

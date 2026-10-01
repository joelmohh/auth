const mongoose = require("mongoose")
const GrantSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: True
    },
    appId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: True
    },
    scopes:[{type:String}],
    lastUsedAt: Date,
    bannedAt: Date,
    revokedAt: Date
}, {timestamps: true})
GrantSchema.index({ userId: 1, appId: 1 }, { unique: true })
GrantSchema.index({ appId: 1 })

module.exports = mongoose.model("Grants", GrantSchema)
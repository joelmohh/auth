const mongoose = require("mongoose");

const otpSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    purpose:{
        type: String,
        enum: ["verify_email", "login", "password_reset"],
        required: true
    },
    code: {
        type: String,
        required: true,
        select: false
    },
    tries: {
        type: Number,
        default: 0
    },
    maxTries:{type: Number, default: 5},
    lastSentAt:{type: Date, default: Date.now()},
    expiresAt:{type: Date, required: true, index: {expires: 0}}
}, { timestamps: true });
otpSchema.index({ userId: 1, purpose: 1}, {unique: true})

module.exports = mongoose.model("Otp", otpSchema);
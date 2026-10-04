const mongoose = require('mongoose');

const sessionSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    refreshToken: {
        type: String,
        required: true,
        unique: true,
        select: false
    },
    userAgent: {
        type: String,
        default: '',
    },
    ip: {
        type: String,
        default: '',
    },
    //TO FIX
    revokedAt: {
        type: Date,
        default: null,
    },
    revokedBy: {
        type: String,
        enum: ['user', 'system', 'password_change', 'reuse_detected']
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    expiresAt: {
        type: Date,
        default: () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        expires: 0
    }
})

const Session = mongoose.model('Session', sessionSchema);
    
module.exports = Session;
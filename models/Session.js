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

    revokedAt: {
        type: Date,
        default: null,
    },
    revokedBy: {
        type: String,
        enum: ['user', 'system', 'password_change']
    },
    createdAt: {
        type: Date,
        default: Date.now(),
        expires: '7d', 
    },
    expiresAt: {
        type: Date,
        default: () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    }
})

const Session = mongoose.model('Session', sessionSchema);
    
module.exports = Session;
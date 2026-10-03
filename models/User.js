const mongoose = require("mongoose")

const UserSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true,
        minlength: 3,
        maxlength: 32
    },
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true
    },
    emailVerifiedAt: {
        type: Date,
        default: null
    },
    password: {
        type: String,
        select: false
    },

    // Optional data
    profile: {
        displayName: {
            type: String,
            maxlength: 64
        },
        avatarUrl: {
            type: String,
            maxlength: 512
        },
        bannerUrl: {
            type: String,
            maxlength: 512
        },
        bio: {
            type: String,
            maxlength: 280
        },
        locale: {
            type: String,
            default: 'pt-BR'
        },
    },
    phone: { type: String, maxlength: 20 },
    address: {
        street: String,
        number: String,
        complement: String,
        city: String,
        state: String,
        zip: String,
        country: String
    },
    birthDate: { type: Date },

    // Account general info
    termsAcceptedAt: { type: Date },
    termsVersion: { type: String },
    status: { 
        type: String, 
        enum: ['active', 'suspended', 'deleted'], 
        default: 'active' 
    },
    lastLoginAt: { 
        type: Date
    },
    deletedAt: { 
        type: Date 
    },                   
}, { timestamps: true });

module.exports = mongoose.model('User', UserSchema)

const mongoose = require("mongoose")

const IdentitySchema = new mongoose.Schema({
    userId: {
        type: ObjectId, 
        ref: 'User', 
        required: true, 
        index: true
    },
    provider: { 
        type: String, 
        required: true 
    },
    providerUserId: { 
        type: String, 
        required: true 
    },
    email: { 
        type: String, 
        lowercase: true 
    },
    displayName: String,
}, { timestamps: true });
IdentitySchema.index({ provider: 1, providerUserId: 1 }, { unique: true });
IdentitySchema.index({ userId: 1, provider: 1 }, { unique: true });

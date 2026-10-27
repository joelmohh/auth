const mongoose = require("mongoose");

const appSchema = new mongoose.Schema({
    ownerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: "true",
        index: true
    },
    name:{
        type: String,
        required: true,
        maxlength: 64
    },
    description: {
        type: String,
        maxlength: 500
    },
    clientId:{
        type: String,
        required: true,
        unique: true
    },
    clientSecret: {
        type: String,
        required: true,
        unique: true,
        select: false
    },
    clientSecrectHash:{
        type: String,
        required: true,
        select: false,
        index: true
    },
    clientSecretLastRotation:{
        type: Date,
        default: Date.now
    },
    redirectUrls: {
        type: [String],
        default: []
    },
    scopes: {
        type: [String],
        default: []
    },
    providers: [{
        provider: {
            _id: false,
            enum: ['x','apple','google','microsoft','discord','github'],
            type: String,
            required: false
        },
        enabled: {
            type: Boolean,
            default: true
        },
        clientId: String,
        clientSecret:{
            type: String,
            select: false
        }
    }],
    theme: {
        primaryColor: { type: String, default: "#FFF"}, //CHANGE LATER
        logoUrl: String,
        bannerUrl: String,
        darkMode: { type: Boolean, default: true }
    },
    status: {
        type: String,
        enum: ["active", "disabled"],
        default: 'active'
    }
}, {timestamps: true})

module.exports = mongoose.model("App", appSchema);
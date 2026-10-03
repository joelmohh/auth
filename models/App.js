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
        unique: true
    },
    redirectUris: [{type: String}],
    scopes: [{type: String}],
    providers: [{
        provider: {
            type: String,
            required: true
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
        backgroundColor: String,
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
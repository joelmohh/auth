const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({

    // Basic user information
    
    username: {
        type: String,
        required: true,
        unique: true,
    },
    email: {
        type: String,
        required: true,
        unique: true,
    },
    password: {
        type: String,
        required: true,
    },

    socialConnections:{
        type: [mongoose.Schema.Types.ObjectId],
        default: [],
    },

    // Additional data for user profile

    phone: {
        type: String,
        default: "",
    },
    address: {
        type: String,
        default: "",
    },
    birthday: {
        type: Date,
        default: null,
    },
    fullName: {
        type: String,
        default: "",
    },

    // Additional fields for user profile

    bio: {
        type: String,
        default: "",
    },
    profilePicture: {
        type: String,
        default: "",
    }, 
    banner:{
        type: String,
        default: "",
    },

    // User creation information

    app:{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'App',
        default: null,
    },
    isAdmin: {
        type: Boolean,
        default: false,
    },
    isVerified: {
        type: Boolean,
        default: false,
    },
    verificatedAt: {
        type: Date,
        default: null,
    }
}, { timestamps: true });

module.exports = mongoose.model("User", userSchema)
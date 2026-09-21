const mongoose = require("mongoose");
const { userInfo } = require("node:os");

const appSchema = new mongoose.Schema({
    name:{
        type: String,
        required: true,
    },
    permissions:{
        type: [String],
        default: [],
    },
    owner:{
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
    },
    description:{
        type: String,
        default: "",
    },
    profilePicture:{
        type: String,
        default: "",
    },
    banner:{
        type: String,
        default: "",
    },
    backgroundColor:{
        type: String,
        default: "#000000",
    },

    redirectURLs:{
        type: [String],
        default: [],
    },
    userInfo:{
        type: [String],
        default: [],
    },
    createdAt:{
        type: Date,
        default: Date.now,
    },
    updatedAt:{
        type: Date,
        default: Date.now,
    }
})

module.exports = mongoose.model("App", appSchema);
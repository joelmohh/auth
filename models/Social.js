const mongoose = require("mongoose");

const socialSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
    },
    platform: {
        type: String,
        required: true,
    }
})
module.exports = mongoose.model("Social", socialSchema);
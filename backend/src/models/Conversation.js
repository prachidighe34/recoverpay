// models/Conversation.js
const mongoose = require("mongoose");

const conversationSchema = new mongoose.Schema(
  {
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    type: { type: String, enum: ["assistant"], default: "assistant" },
    status: { type: String, enum: ["open", "closed"], default: "open" }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Conversation", conversationSchema);
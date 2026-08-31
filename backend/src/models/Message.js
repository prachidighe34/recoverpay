// models/Message.js
const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema(
  {
    conversationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Conversation",
      required: true
    },
    sender: { type: String, enum: ["customer", "assistant"], required: true },
    text: { type: String, required: true },
    // set when sender === "assistant" and this message showed a cart
    cartDraftId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CartDraft",
      default: null
    }
  },
  { timestamps: true }
);

messageSchema.index({ conversationId: 1, createdAt: 1 });

module.exports = mongoose.model("Message", messageSchema);
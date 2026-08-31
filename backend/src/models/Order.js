const mongoose = require("mongoose");
 
const orderSchema = new mongoose.Schema(
  {
    conversationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Conversation",
      required: true
    },
    cartDraftId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CartDraft",
      required: true
    },
    // The key the client sends with /checkout/confirm. One key -> one order, ever.
    // This unique index is the real guarantee against double charges, not app logic.
    idempotency_key: {
      type: String,
      required: true,
      unique: true
    },
    razorpay_order_id: {
      type: String,
      required: true
    },
    razorpay_payment_id: {
      type: String,
      default: null
    },
    amount_paise: {
      type: Number,
      required: true
    },
    status: {
      type: String,
      enum: ["created", "paid", "failed", "unpaid", "expired"],
      default: "created"
    },
    // set true only after webhook/client signature verification passes
    verified: {
      type: Boolean,
      default: false
    }
  },
  { timestamps: true }
);
 

 
module.exports = mongoose.model("Order", orderSchema);
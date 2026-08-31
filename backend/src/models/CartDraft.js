const mongoose = require("mongoose");
 
const cartItemSchema = new mongoose.Schema(
  {
    sku: { type: String, required: true },
    name: { type: String, required: true },
    qty: { type: Number, required: true },
    price_paise: { type: Number, required: true }
  },
  { _id: false }
);
 
const cartDraftSchema = new mongoose.Schema(
  {
    conversationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Conversation",
      required: true
    },
    items: { type: [cartItemSchema], required: true },
    total_paise: { type: Number, required: true },
    // hash of {items, total} — /checkout/confirm must be sent this to prove
    // the client is confirming the *last* cart the agent actually showed.
    cart_hash: { type: String, required: true },
    // TTL: Mongo auto-deletes the doc once expires_at passes.
    // /checkout/confirm should still explicitly re-check expiry before
    // trusting a cart_hash, since a query could land in the gap before deletion.
    expires_at: { type: Date, required: true }
  },
  { timestamps: true }
);
 
cartDraftSchema.index({ expires_at: 1 }, { expireAfterSeconds: 0 });
 
module.exports = mongoose.model("CartDraft", cartDraftSchema);
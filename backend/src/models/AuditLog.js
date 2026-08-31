// models/AuditLog.js
const mongoose = require("mongoose");

const AUDIT_EVENTS = [
  "message_received",
  "catalog_listed",
  "intent_parsed",
  "intent_parse_failed",
  "cart_drafted",
  "checkout_confirmed",
  "razorpay_order_created",
  "payment_verified",
  "payment_failed",
  "duplicate_confirm_blocked",
  "cart_expired"
];

const auditLogSchema = new mongoose.Schema(
  {
    conversationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Conversation",
      required: true
    },
    event: { type: String, enum: AUDIT_EVENTS, required: true },
    // free-form snapshot: message_id, intent json, cart_hash, order_id,
    // payment_id, status — whatever is relevant to this event
    payload: { type: mongoose.Schema.Types.Mixed, default: {} }
  },
  { timestamps: true }
);

auditLogSchema.index({ conversationId: 1, createdAt: 1 });

module.exports = mongoose.model("AuditLog", auditLogSchema);
module.exports.AUDIT_EVENTS = AUDIT_EVENTS;
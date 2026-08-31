// services/checkout.service.js
const CartDraft = require("../models/CartDraft");
const Order = require("../models/Order");
const razorpayService = require("./razorpay.service");
const { logEvent } = require("./audit.service");

/**
 * Confirms a cart and creates a Razorpay test-mode order.
 * Gated by:
 *   1. cart_hash must match the CartDraft's current hash (proves the
 *      client is confirming the exact cart last shown, not stale/tampered)
 *   2. cart must not be expired
 *   3. idempotency_key must not already have an Order (DB unique index
 *      is the hard backstop; we also check first for a clean error message)
 *
 * @param {Object} params
 * @param {string} params.conversationId
 * @param {string} params.cartDraftId
 * @param {string} params.cart_hash
 * @param {string} params.idempotency_key
 */
async function confirmCheckout({ conversationId, cartDraftId, cart_hash, idempotency_key }) {
  // Check for an existing order under this key FIRST — if found, this is a
  // retry/double-tap, not a new checkout. Return the existing order instead
  // of erroring, so the client's UI can just show the same result.
  const existingOrder = await Order.findOne({ idempotency_key });
  if (existingOrder) {
    await logEvent(conversationId, "duplicate_confirm_blocked", {
      idempotency_key,
      existingOrderId: existingOrder._id
    });
    return { order: existingOrder, isNew: false };
  }

  const cartDraft = await CartDraft.findById(cartDraftId);
  if (!cartDraft) {
    const err = new Error("Cart not found or expired");
    err.status = 410;
    throw err;
  }

  if (cartDraft.expires_at < new Date()) {
    await logEvent(conversationId, "cart_expired", { cartDraftId });
    const err = new Error("Cart expired — please confirm again");
    err.status = 410;
    throw err;
  }

  if (cartDraft.cart_hash !== cart_hash) {
    const err = new Error("cart_hash mismatch — cart may have changed, please review again");
    err.status = 409;
    throw err;
  }

  await logEvent(conversationId, "checkout_confirmed", {
    cartDraftId, cart_hash, idempotency_key
  });

  const razorpayOrder = await razorpayService.createOrder({
    amountPaise: cartDraft.total_paise,
    idempotencyKey: idempotency_key,
    notes: { conversationId: String(conversationId), cartDraftId: String(cartDraftId) }
  });

  // If two requests race past the findOne check above, the unique index
  // on idempotency_key makes exactly one Order.create succeed; the other
  // throws a duplicate-key error (code 11000), caught by error.middleware.js.
  const order = await Order.create({
    conversationId,
    cartDraftId,
    idempotency_key,
    razorpay_order_id: razorpayOrder.id,
    amount_paise: cartDraft.total_paise,
    status: "created"
  });

  await logEvent(conversationId, "razorpay_order_created", {
    orderId: order._id,
    razorpay_order_id: razorpayOrder.id
  });

  return { order, isNew: true, razorpayOrder };
}

/**
 * Verifies payment signature (client-side handler path) and updates
 * the Order status accordingly. Webhook path uses the same idea but
 * verifies against the raw body with verifyWebhookSignature instead —
 * see checkout.controller.js.
 */
async function verifyCheckout({ conversationId, razorpay_order_id, razorpay_payment_id, razorpay_signature }) {
  const order = await Order.findOne({ razorpay_order_id });
  if (!order) {
    const err = new Error("Order not found");
    err.status = 404;
    throw err;
  }

  const valid = razorpayService.verifySignature({
    orderId: razorpay_order_id,
    paymentId: razorpay_payment_id,
    signature: razorpay_signature,
    secret: require("../config/env").razorpay.keySecret
  });

  if (!valid) {
    order.status = "failed";
    await order.save();
    await logEvent(conversationId, "payment_failed", {
      orderId: order._id,
      reason: "signature_mismatch"
    });
    const err = new Error("Payment verification failed — not charged");
    err.status = 400;
    throw err;
  }

  order.status = "paid";
  order.razorpay_payment_id = razorpay_payment_id;
  order.verified = true;
  await order.save();

  await logEvent(conversationId, "payment_verified", {
    orderId: order._id,
    razorpay_payment_id
  });

  return order;
}

module.exports = { confirmCheckout, verifyCheckout };
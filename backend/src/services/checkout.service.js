const CartDraft = require("../models/CartDraft");
const Order = require("../models/Order");
const Product = require("../models/Product");
const razorpayService = require("./razorpay.service");
const { logEvent } = require("./audit.service");
const {
  CartNotFoundError, CartExpiredError, CartHashMismatchError,
  PriceChangedError, OutOfStockError, PaymentVerificationError, NotFoundError
} = require("../utils/errors");

/**
 * Confirms a cart and creates a Razorpay test-mode order.
 * Gated by, in order:
 *   1. idempotency_key reuse check (retry/double-tap → return existing order)
 *   2. cart exists and is not expired
 *   3. cart_hash matches (proves client is confirming the exact cart shown)
 *   4. live price/stock re-check against Product — the cart_hash alone only
 *      proves the CLIENT didn't tamper with what it saw; it does NOT catch
 *      a merchant changing a price or stock AFTER the cart was drafted but
 *      BEFORE confirm. This step closes that gap.
 *
 * @param {Object} params
 * @param {string} params.conversationId
 * @param {string} params.cartDraftId
 * @param {string} params.cart_hash
 * @param {string} params.idempotency_key
 */
async function confirmCheckout({ conversationId, cartDraftId, cart_hash, idempotency_key }) {
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
    throw new CartNotFoundError({ cartDraftId });
  }

  if (cartDraft.expires_at < new Date()) {
    await logEvent(conversationId, "cart_expired", { cartDraftId });
    throw new CartExpiredError({ cartDraftId, expires_at: cartDraft.expires_at });
  }

  if (cartDraft.cart_hash !== cart_hash) {
    await logEvent(conversationId, "cart_validation_failed", {
      reason: "hash_mismatch", provided_hash: cart_hash, expected_hash: cartDraft.cart_hash
    });
    throw new CartHashMismatchError({ provided_hash: cart_hash, expected_hash: cartDraft.cart_hash });
  }

  // --- live price/stock re-check (closes the merchant-changed-price gap) ---
  const skus = cartDraft.items.map((i) => i.sku);
  const liveProducts = await Product.find({ sku: { $in: skus } });
  const liveBySkU = new Map(liveProducts.map((p) => [p.sku, p]));

  const priceMismatches = [];
  const outOfStock = [];

  for (const item of cartDraft.items) {
    const live = liveBySkU.get(item.sku);
    if (!live) {
      priceMismatches.push({ sku: item.sku, reason: "product_removed" });
      continue;
    }
    if (live.price_paise !== item.price_paise) {
      priceMismatches.push({ sku: item.sku, cart_price_paise: item.price_paise, current_price_paise: live.price_paise });
    }
    if (live.stock < item.qty) {
      outOfStock.push({ sku: item.sku, requested: item.qty, available: live.stock });
    }
  }

  if (priceMismatches.length > 0) {
    await logEvent(conversationId, "cart_validation_failed", { reason: "price_changed", priceMismatches });
    throw new PriceChangedError({ priceMismatches });
  }
  if (outOfStock.length > 0) {
    await logEvent(conversationId, "cart_validation_failed", { reason: "out_of_stock", outOfStock });
    throw new OutOfStockError({ outOfStock });
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
    razorpay_order_id: razorpayOrder.id,
    amount_paise: order.amount_paise,
    idempotency_key
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
    throw new NotFoundError("Order not found", "ORDER_NOT_FOUND", { razorpay_order_id });
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
    throw new PaymentVerificationError({ orderId: order._id });
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
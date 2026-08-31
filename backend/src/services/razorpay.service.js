// services/razorpay.service.js
const crypto = require("crypto");
const razorpayClient = require("../config/razorpay");
const env = require("../config/env");

/**
 * Creates a Razorpay test-mode order.
 * Caller (checkout.service.js) is responsible for:
 *   - checking cart_hash matches the last agent cart
 *   - checking no Order already exists for this idempotency_key
 *     (the Order model's unique index is the hard backstop)
 *
 * @param {Object} params
 * @param {number} params.amountPaise - total amount in paise (smallest unit)
 * @param {string} params.idempotencyKey - client-supplied key, also used as Razorpay receipt
 * @param {Object} [params.notes] - arbitrary metadata attached to the order (e.g. conversationId)
 * @returns {Promise<Object>} Razorpay order object
 */
async function createOrder({ amountPaise, idempotencyKey, notes = {} }) {
  if (!Number.isInteger(amountPaise) || amountPaise <= 0) {
    throw new Error("amountPaise must be a positive integer");
  }
  if (!idempotencyKey) {
    throw new Error("idempotencyKey is required");
  }

  const order = await razorpayClient.orders.create({
    amount: amountPaise,
    currency: "INR",
    receipt: idempotencyKey,
    notes,
  });

  return order;
}

/**
 * Verifies the signature Razorpay sends back after checkout (client-side handler)
 * OR via webhook — same HMAC scheme, different secret source.
 *
 * Client-side verify uses key_secret; webhook verify uses the webhook secret.
 * Pass the correct secret in depending on which path is calling this.
 */
function verifySignature({ orderId, paymentId, signature, secret }) {
  const expected = crypto
    .createHmac("sha256", secret)
    .update(`${orderId}|${paymentId}`)
    .digest("hex");

  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}

/**
 * Verifies a raw webhook payload against RAZORPAY_WEBHOOK_SECRET.
 * Razorpay signs the raw request body, not a derived string — use this
 * for the POST /checkout/verify webhook path.
 */
function verifyWebhookSignature({ rawBody, signature }) {
  const expected = crypto
    .createHmac("sha256", env.razorpay.webhookSecret)
    .update(rawBody)
    .digest("hex");

  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}

module.exports = {
  createOrder,
  verifySignature,
  verifyWebhookSignature,
};


// Run with: node --test tests/audit_completeness.test.js
//
// Walks the full flow the same way agent.controller.js does (message ->
// intent -> cart -> confirm -> verify), then asserts the AuditLog actually
// contains every step a reviewer would expect to trace. Also proves a
// blocked duplicate leaves exactly one razorpay_order_created event.
//
// Needs: local Mongo running, real .env (hits real Razorpay test API).

const test = require("node:test");
const assert = require("node:assert");
const mongoose = require("mongoose");
const crypto = require("crypto");

if (!global.crypto) {
  global.crypto = require("crypto").webcrypto;
}
require("dotenv").config();

const TEST_DB_URI = "mongodb://localhost:27017/storechat_test_auditcompleteness";

const Product = require("../src/models/Product");
const CartDraft = require("../src/models/CartDraft");
const Order = require("../src/models/Order");
const AuditLog = require("../src/models/AuditLog");
const { confirmCheckout, verifyCheckout } = require("../src/services/checkout.service");
const { logEvent } = require("../src/services/audit.service");
const { parseMessage } = require("../src/services/parser.service");
const { buildCartDraft } = require("../src/services/cart.service");
const razorpayService = require("../src/services/razorpay.service");

test.before(async () => {
  await mongoose.connect(TEST_DB_URI);
});

test.after(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
});

test("a full paid conversation has a complete, traceable audit trail", async () => {
  await Product.deleteMany({});
  await CartDraft.deleteMany({});
  await Order.deleteMany({});
  await AuditLog.deleteMany({});

  const product = await Product.create({
    sku: "AUDIT-TEST-1", name: "Audit Test Item", price_paise: 8000, stock: 20, unit: "unit"
  });

  const conversationId = new mongoose.Types.ObjectId();
  const message = "1 audit test item";

  // replicate agent.controller.js's sequence exactly
  await logEvent(conversationId, "message_received", { message });
  const parsed = parseMessage(message, [product]);
  await logEvent(conversationId, "intent_parsed", { message, items: parsed.items });
  const { cartDraft } = await buildCartDraft(conversationId, parsed.items);
  await logEvent(conversationId, "cart_drafted", {
    cartDraftId: cartDraft._id, cart_hash: cartDraft.cart_hash, total_paise: cartDraft.total_paise
  });

  const idempotency_key = `audit-test-${Date.now()}`;
  const { order, razorpayOrder } = await confirmCheckout({
    conversationId, cartDraftId: cartDraft._id, cart_hash: cartDraft.cart_hash, idempotency_key
  });

  const paymentId = `pay_test_${crypto.randomBytes(6).toString("hex")}`;
  const signature = crypto
    .createHmac("sha256", require("../src/config/env").razorpay.keySecret)
    .update(`${razorpayOrder.id}|${paymentId}`)
    .digest("hex");

  await verifyCheckout({
    conversationId, razorpay_order_id: razorpayOrder.id,
    razorpay_payment_id: paymentId, razorpay_signature: signature
  });

  const trail = await AuditLog.find({ conversationId }).sort({ createdAt: 1 }).lean();
  const events = trail.map((e) => e.event);

  const required = [
    "message_received", "intent_parsed", "cart_drafted",
    "checkout_confirmed", "razorpay_order_created", "payment_verified"
  ];
  for (const requiredEvent of required) {
    assert.ok(events.includes(requiredEvent), `audit trail missing "${requiredEvent}"`);
  }

  // events should appear in a sensible chronological order, not just be present
  const indices = required.map((e) => events.indexOf(e));
  const isSorted = indices.every((val, i) => i === 0 || val >= indices[i - 1]);
  assert.ok(isSorted, "audit events should appear in chronological order");
});

test("a blocked duplicate confirm leaves exactly one razorpay_order_created event", async () => {
  await Product.deleteMany({});
  await CartDraft.deleteMany({});
  await Order.deleteMany({});
  await AuditLog.deleteMany({});

  const product = await Product.create({
    sku: "AUDIT-DUP-1", name: "Audit Dup Item", price_paise: 4000, stock: 20, unit: "unit"
  });

  const conversationId = new mongoose.Types.ObjectId();
  const items = [{ sku: product.sku, qty: 1 }];
  const { cartDraft } = await buildCartDraft(conversationId, items);

  const idempotency_key = `audit-dup-test-${Date.now()}`;
  const confirmArgs = { conversationId, cartDraftId: cartDraft._id, cart_hash: cartDraft.cart_hash, idempotency_key };

  await confirmCheckout(confirmArgs); // first — creates the order
  await confirmCheckout(confirmArgs); // second — should be blocked, not create a new order

  const trail = await AuditLog.find({ conversationId }).lean();
  const events = trail.map((e) => e.event);

  const orderCreatedCount = events.filter((e) => e === "razorpay_order_created").length;
  assert.strictEqual(orderCreatedCount, 1, "only one razorpay_order_created event should exist");

  assert.ok(events.includes("duplicate_confirm_blocked"), "audit trail should record the blocked duplicate");
});
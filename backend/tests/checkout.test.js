// tests/checkout.test.js
// Run with: node --test tests/checkout.test.js
//
// This is an INTEGRATION test — it needs your local MongoDB running
// (the same one from `docker compose up -d mongo` or local mongod).
// It uses a separate "storechat_test" database so it never touches
// your real dev data, and drops that DB when done.
//
// It does NOT call the real Razorpay API — createOrder is stubbed out,
// since hitting a live (even test-mode) payment API in a test suite
// is slow and not what this test is proving. What it proves is the
// DB-level guarantee: the unique index on Order.idempotency_key.

const test = require("node:test");
const assert = require("node:assert");
const mongoose = require("mongoose");

if (!global.crypto) {
  global.crypto = require("crypto").webcrypto;
}

const TEST_DB_URI = "mongodb://localhost:27017/storechat_test";

const Order = require("../src/models/Order");
const CartDraft = require("../src/models/CartDraft");

test.before(async () => {
  await mongoose.connect(TEST_DB_URI);
});

test.after(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
});

test.beforeEach(async () => {
  await Order.deleteMany({});
  await CartDraft.deleteMany({});
});

test("unique index on idempotency_key rejects a second Order with the same key", async () => {
  const cartDraft = await CartDraft.create({
    conversationId: new mongoose.Types.ObjectId(),
    items: [{ sku: "RICE-BASMATI-1KG", name: "Basmati Rice", qty: 2, price_paise: 12000 }],
    total_paise: 24000,
    cart_hash: "fakehash123",
    expires_at: new Date(Date.now() + 15 * 60 * 1000)
  });

  const orderData = {
    conversationId: cartDraft.conversationId,
    cartDraftId: cartDraft._id,
    idempotency_key: "test-dup-key-001",
    razorpay_order_id: "order_fake1",
    amount_paise: 24000,
    status: "created"
  };

  await Order.create(orderData);

  // Second create with the SAME idempotency_key must fail at the DB level —
  // this is the actual guarantee against double charges, not app logic.
  await assert.rejects(
    () => Order.create({ ...orderData, razorpay_order_id: "order_fake2" }),
    (err) => err.code === 11000 // Mongo duplicate key error
  );

  const count = await Order.countDocuments({ idempotency_key: "test-dup-key-001" });
  assert.strictEqual(count, 1, "exactly one order should exist for this key");
});

test("two different idempotency_keys both succeed", async () => {
  const cartDraft = await CartDraft.create({
    conversationId: new mongoose.Types.ObjectId(),
    items: [{ sku: "ONION-1KG", name: "Onion", qty: 1, price_paise: 3500 }],
    total_paise: 3500,
    cart_hash: "fakehash456",
    expires_at: new Date(Date.now() + 15 * 60 * 1000)
  });

  await Order.create({
    conversationId: cartDraft.conversationId,
    cartDraftId: cartDraft._id,
    idempotency_key: "key-A",
    razorpay_order_id: "order_A",
    amount_paise: 3500,
    status: "created"
  });

  await Order.create({
    conversationId: cartDraft.conversationId,
    cartDraftId: cartDraft._id,
    idempotency_key: "key-B",
    razorpay_order_id: "order_B",
    amount_paise: 3500,
    status: "created"
  });

  const count = await Order.countDocuments({});
  assert.strictEqual(count, 2);
});
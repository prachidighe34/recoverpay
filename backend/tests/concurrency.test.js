
// Run with: node --test tests/concurrency.test.js
//
// Simulates the actual "2 AM double-tap" scenario: two near-simultaneous
// /checkout/confirm calls with the SAME idempotency_key, fired with
// Promise.all so they genuinely race each other at the database level —
// not sequential calls that never really test the race condition.
//
// Needs: local Mongo running, real .env (this hits the real Razorpay
// test API, since confirmCheckout isn't mocked — same as checkout.test.js).

const test = require("node:test");
const assert = require("node:assert");
const mongoose = require("mongoose");

if (!global.crypto) {
  global.crypto = require("crypto").webcrypto;
}
require("dotenv").config();

const TEST_DB_URI = "mongodb://localhost:27017/storechat_test_concurrency";

const Product = require("../src/models/Product");
const CartDraft = require("../src/models/CartDraft");
const Order = require("../src/models/Order");
const { confirmCheckout } = require("../src/services/checkout.service");
const { computeCartHash } = require("../src/utils/cart-hash");

test.before(async () => {
  await mongoose.connect(TEST_DB_URI);
});

test.after(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
});

test("two simultaneous confirms with the same idempotency_key produce exactly one Order", async () => {
  await Product.deleteMany({});
  await CartDraft.deleteMany({});
  await Order.deleteMany({});

  const product = await Product.create({
    sku: "CONCUR-TEST-1", name: "Concurrency Test Item", price_paise: 10000, stock: 50, unit: "unit"
  });

  const items = [{ sku: product.sku, name: product.name, qty: 1, price_paise: product.price_paise }];
  const total_paise = 10000;
  const cart_hash = computeCartHash(items, total_paise);

  const cartDraft = await CartDraft.create({
    conversationId: new mongoose.Types.ObjectId(),
    items, total_paise, cart_hash,
    expires_at: new Date(Date.now() + 15 * 60 * 1000)
  });

  const idempotency_key = `concurrency-test-${Date.now()}`;
  const confirmArgs = {
    conversationId: cartDraft.conversationId,
    cartDraftId: cartDraft._id,
    cart_hash,
    idempotency_key
  };

  // Fire both at once — this is the actual race, not two sequential awaits.
  const results = await Promise.allSettled([
    confirmCheckout(confirmArgs),
    confirmCheckout(confirmArgs)
  ]);

  // Whichever way the race resolves (one clean isNew:false, or a raw
  // duplicate-key rejection on the loser), the DB-level guarantee is
  // the thing that actually matters:
  const orderCount = await Order.countDocuments({ idempotency_key });
  assert.strictEqual(orderCount, 1, "exactly one Order should exist after the race");

  const fulfilled = results.filter((r) => r.status === "fulfilled").map((r) => r.value);
  assert.ok(fulfilled.length >= 1, "at least one confirm call should succeed");

  // Every fulfilled result must point at the SAME Razorpay order — no
  // customer-visible inconsistency even if the race happened internally.
  const orderIds = new Set(fulfilled.map((r) => String(r.order.razorpay_order_id)));
  assert.strictEqual(orderIds.size, 1, "all successful responses must reference the same Razorpay order");
});
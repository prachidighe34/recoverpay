// Run with: node --test tests/cart-validation.test.js
//
// Proves the gap cart_hash alone can't catch: a merchant changing a
// price or stock AFTER a cart was drafted but BEFORE the customer
// confirms. cart_hash only proves the CLIENT didn't tamper with what
// it was shown — it says nothing about whether that snapshot is still
// valid. checkout.service.js re-checks live Product data at confirm
// time specifically to close this.
//
// Needs: local Mongo running, real .env.

const test = require("node:test");
const assert = require("node:assert");
const mongoose = require("mongoose");

if (!global.crypto) {
  global.crypto = require("crypto").webcrypto;
}
require("dotenv").config();

const TEST_DB_URI = "mongodb://localhost:27017/storechat_test_cartvalidation";

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

test.beforeEach(async () => {
  await Product.deleteMany({});
  await CartDraft.deleteMany({});
  await Order.deleteMany({});
});

test("price changed after draft is rejected with PRICE_CHANGED, no order created", async () => {
  const product = await Product.create({
    sku: "PRICE-TEST-1", name: "Price Test Item", price_paise: 5000, stock: 20, unit: "unit"
  });

  // snapshot at draft time
  const items = [{ sku: product.sku, name: product.name, qty: 1, price_paise: 5000 }];
  const cart_hash = computeCartHash(items, 5000);
  const cartDraft = await CartDraft.create({
    conversationId: new mongoose.Types.ObjectId(),
    items, total_paise: 5000, cart_hash,
    expires_at: new Date(Date.now() + 15 * 60 * 1000)
  });

  // merchant changes the price between draft and confirm
  await Product.updateOne({ sku: product.sku }, { $set: { price_paise: 7500 } });

  await assert.rejects(
    () => confirmCheckout({
      conversationId: cartDraft.conversationId,
      cartDraftId: cartDraft._id,
      cart_hash, // still the OLD hash — client hasn't seen the price change
      idempotency_key: `price-test-${Date.now()}`
    }),
    (err) => err.code === "PRICE_CHANGED"
  );

  const orderCount = await Order.countDocuments({});
  assert.strictEqual(orderCount, 0, "no order should be created when price changed");
});

test("stock dropped below cart quantity is rejected with OUT_OF_STOCK, no order created", async () => {
  const product = await Product.create({
    sku: "STOCK-TEST-1", name: "Stock Test Item", price_paise: 3000, stock: 10, unit: "unit"
  });

  const items = [{ sku: product.sku, name: product.name, qty: 5, price_paise: 3000 }];
  const total_paise = 15000;
  const cart_hash = computeCartHash(items, total_paise);
  const cartDraft = await CartDraft.create({
    conversationId: new mongoose.Types.ObjectId(),
    items, total_paise, cart_hash,
    expires_at: new Date(Date.now() + 15 * 60 * 1000)
  });

  // stock sells out between draft and confirm
  await Product.updateOne({ sku: product.sku }, { $set: { stock: 2 } });

  await assert.rejects(
    () => confirmCheckout({
      conversationId: cartDraft.conversationId,
      cartDraftId: cartDraft._id,
      cart_hash,
      idempotency_key: `stock-test-${Date.now()}`
    }),
    (err) => err.code === "OUT_OF_STOCK"
  );

  const orderCount = await Order.countDocuments({});
  assert.strictEqual(orderCount, 0, "no order should be created when stock is insufficient");
});
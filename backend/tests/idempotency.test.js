
// Run with: node --test tests/idempotency.test.js
// Uses Node's built-in test runner — no extra dependency needed.

const test = require("node:test");
const assert = require("node:assert");
const { computeCartHash } = require("../src/utils/cart-hash");

test("same items in same order produce the same hash", () => {
  const items = [
    { sku: "RICE-BASMATI-1KG", qty: 2, price_paise: 12000 },
    { sku: "OIL-SUNFLOWER-1L", qty: 1, price_paise: 15000 }
  ];
  const hash1 = computeCartHash(items, 39000);
  const hash2 = computeCartHash(items, 39000);
  assert.strictEqual(hash1, hash2);
});

test("same items in different order produce the same hash (order-independent)", () => {
  const itemsA = [
    { sku: "RICE-BASMATI-1KG", qty: 2, price_paise: 12000 },
    { sku: "OIL-SUNFLOWER-1L", qty: 1, price_paise: 15000 }
  ];
  const itemsB = [
    { sku: "OIL-SUNFLOWER-1L", qty: 1, price_paise: 15000 },
    { sku: "RICE-BASMATI-1KG", qty: 2, price_paise: 12000 }
  ];
  assert.strictEqual(computeCartHash(itemsA, 39000), computeCartHash(itemsB, 39000));
});

test("different quantity produces a different hash", () => {
  const items = [{ sku: "RICE-BASMATI-1KG", qty: 2, price_paise: 12000 }];
  const itemsChanged = [{ sku: "RICE-BASMATI-1KG", qty: 3, price_paise: 12000 }];
  assert.notStrictEqual(
    computeCartHash(items, 24000),
    computeCartHash(itemsChanged, 36000)
  );
});

test("different total produces a different hash even with same items (tamper detection)", () => {
  const items = [{ sku: "RICE-BASMATI-1KG", qty: 2, price_paise: 12000 }];
  assert.notStrictEqual(
    computeCartHash(items, 24000),
    computeCartHash(items, 1) // tampered total
  );
});
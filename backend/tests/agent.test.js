// Run with: node --test tests/agent.test.js

const test = require("node:test");
const assert = require("node:assert");
const { parseMessage } = require("../src/services/parser.service");

// Fake catalog — same shape as Product documents, no DB needed.
const catalog = [
  { sku: "RICE-BASMATI-1KG", name: "Basmati Rice" },
  { sku: "OIL-SUNFLOWER-1L", name: "Sunflower Oil" },
  { sku: "ONION-1KG", name: "Onion" },
  { sku: "TOMATO-1KG", name: "Tomato" }
];

test("parses a simple message with quantity and unit", () => {
  const result = parseMessage("2kg rice and 1 oil", catalog);
  assert.strictEqual(result.items.length, 2);
  assert.deepStrictEqual(
    result.items.map((i) => i.sku).sort(),
    ["OIL-SUNFLOWER-1L", "RICE-BASMATI-1KG"]
  );
  const rice = result.items.find((i) => i.sku === "RICE-BASMATI-1KG");
  assert.strictEqual(rice.qty, 2);
});

test("defaults quantity to 1 when none is given", () => {
  const result = parseMessage("onion", catalog);
  assert.strictEqual(result.items.length, 1);
  assert.strictEqual(result.items[0].qty, 1);
});

test("returns no items and a note for completely unmatched input", () => {
  const result = parseMessage("asdkfjhasldkfj", catalog);
  assert.strictEqual(result.items.length, 0);
  assert.ok(result.notes.length > 0);
});

test("handles multiple items with commas and 'and'", () => {
  const result = parseMessage("1 onion, 2 tomato and 1kg rice", catalog);
  assert.strictEqual(result.items.length, 3);
});
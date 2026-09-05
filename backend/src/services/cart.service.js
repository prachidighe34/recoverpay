const Product = require("../models/Product");
const CartDraft = require("../models/CartDraft");
const { computeCartHash } = require("../utils/cart-hash");

const CART_TTL_MINUTES = 15;

/**
 * Turns parsed { sku, qty } items into a priced, hashed CartDraft
 * against the CURRENT catalog (never trust prices from the parser output).
 *
 * @param {string} conversationId
 * @param {Array<{sku: string, qty: number}>} parsedItems
 * @returns {Promise<{ cartDraft: Object, outOfStock: string[] }>}
 */
async function buildCartDraft(conversationId, parsedItems) {
  const skus = parsedItems.map((i) => i.sku);
  const products = await Product.find({ sku: { $in: skus } });
  const productMap = new Map(products.map((p) => [p.sku, p]));

  const items = [];
  const outOfStock = [];

  for (const parsed of parsedItems) {
    const product = productMap.get(parsed.sku);
    if (!product) continue; // shouldn't happen if parser only matched real skus

    if (product.stock < parsed.qty) {
      outOfStock.push(product.sku);
      continue;
    }

    items.push({
      sku: product.sku,
      name: product.name,
      qty: parsed.qty,
      price_paise: product.price_paise
    });
  }

  const total_paise = items.reduce(
    (sum, item) => sum + item.price_paise * item.qty,
    0
  );

  const cart_hash = computeCartHash(items, total_paise);
  const expires_at = new Date(Date.now() + CART_TTL_MINUTES * 60 * 1000);

  const cartDraft = await CartDraft.create({
    conversationId,
    items,
    total_paise,
    cart_hash,
    expires_at
  });

  return { cartDraft, outOfStock };
}

module.exports = { buildCartDraft, CART_TTL_MINUTES };
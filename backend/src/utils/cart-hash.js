const crypto = require("crypto");

/**
 * Deterministic hash of a cart's items + total.
 * Used so /checkout/confirm can prove the client is confirming
 * the exact cart the agent last showed — not a stale or tampered one.
 *
 * @param {Array<{sku: string, qty: number, price_paise: number}>} items
 * @param {number} totalPaise
 * @returns {string} hex hash
 */
function computeCartHash(items, totalPaise) {
  // sort by sku so item order never changes the hash
  const normalized = [...items]
    .sort((a, b) => a.sku.localeCompare(b.sku))
    .map((item) => `${item.sku}:${item.qty}:${item.price_paise}`)
    .join("|");

  const payload = `${normalized}#total:${totalPaise}`;

  return crypto.createHash("sha256").update(payload).digest("hex");
}

module.exports = { computeCartHash };
// services/parser.service.js
//
// Keyword-based message parser — no LLM involved.
// Extracts { items: [{sku, qty}], notes } from a free-text message
// by matching quantities + words against the product catalog.
//
// This is intentionally the SAME output shape the LLM-based parser will
// produce later (Day 5-6). agent.controller.js doesn't care which one
// ran — it just validates the JSON shape and matches skus against catalog.

const STOPWORDS = new Set([
  "i", "need", "want", "please", "get", "me", "a", "an", "the",
  "of", "some", "and", "also", "add", "give", "with"
]);

const UNIT_WORDS = new Set([
  "kg", "kgs", "g", "gram", "grams", "l", "litre", "litres", "ltr",
  "pc", "pcs", "piece", "pieces", "unit", "units", "pack", "packs"
]);

function tokenize(text) {
  return text
    .toLowerCase()
    .replace(/[^\w\s.]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

function stripStopwordsAndUnits(words) {
  return words.filter((w) => !STOPWORDS.has(w) && !UNIT_WORDS.has(w));
}

// crude singularizer: "onions" -> "onion", "tomatoes" -> "tomato"
function singularize(word) {
  if (word.endsWith("oes")) return word.slice(0, -2);
  if (word.endsWith("ies")) return `${word.slice(0, -3)}y`;
  if (word.endsWith("s") && !word.endsWith("ss")) return word.slice(0, -1);
  return word;
}

/**
 * Splits a raw message into rough item segments.
 * "2kg rice and 1 oil, plus soap" -> ["2kg rice", "1 oil", "soap"]
 */
function splitSegments(message) {
  return message
    .split(/,|\band\b|\bplus\b|\+/i)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Extracts a leading quantity + unit from a segment, if present.
 * "2kg rice" -> { qty: 2, unit: "kg", rest: "rice" }
 * "rice" -> { qty: 1, unit: null, rest: "rice" }
 */
function extractQuantity(segment) {
  const match = segment
    .toLowerCase()
    .match(/^(\d+\.?\d*)\s*(kg|kgs|g|gram|grams|l|litre|litres|ltr|pc|pcs|piece|pieces|unit|units|pack|packs)?\b(.*)$/);

  if (match) {
    return {
      qty: parseFloat(match[1]),
      unit: match[2] || null,
      rest: match[3].trim()
    };
  }

  return { qty: 1, unit: null, rest: segment };
}

/**
 * Scores how well a segment's remaining words match a product's name.
 * Returns 0 if no overlap at all.
 */
function scoreMatch(words, product) {
  const productWords = tokenize(product.name).map(singularize);
  const segWords = words.map(singularize);

  let score = 0;
  for (const w of segWords) {
    if (productWords.includes(w)) score += 1;
  }
  return score;
}

/**
 * @param {string} message - raw customer message
 * @param {Array} products - catalog products (from Product.find())
 * @returns {{ items: Array<{sku: string, qty: number, matchedName: string}>, notes: string, unmatched: string[] }}
 */
function parseMessage(message, products) {
  const segments = splitSegments(message);
  const items = [];
  const unmatched = [];

  for (const segment of segments) {
    const { qty, rest } = extractQuantity(segment);
    if (!rest) continue;

    const words = stripStopwordsAndUnits(tokenize(rest));
    if (words.length === 0) continue;

    let bestProduct = null;
    let bestScore = 0;

    for (const product of products) {
      const score = scoreMatch(words, product);
      if (score > bestScore) {
        bestScore = score;
        bestProduct = product;
      }
    }

    if (bestProduct && bestScore > 0) {
      items.push({
        sku: bestProduct.sku,
        qty,
        matchedName: bestProduct.name
      });
    } else {
      unmatched.push(segment);
    }
  }

  return {
    items,
    notes: unmatched.length > 0
      ? `Could not match: ${unmatched.join(", ")}`
      : "",
    unmatched
  };
}

/**
 * Detects "what do you have / show me your products" style messages —
 * these should list the catalog, not attempt to build a cart.
 * Checked BEFORE parseMessage, since a message like "show me rice" would
 * otherwise partially match the item "rice" and confuse the two intents.
 */
const CATALOG_QUERY_PATTERN =
  /\b(what.*(have|sell|stock|carry)|show.*(product|catalog|item|menu)|what.*(available|in stock)|list.*(product|item)|^(menu|catalog|products)$)\b/i;

function isCatalogQuery(message) {
  return CATALOG_QUERY_PATTERN.test(message.trim());
}

/**
 * Formats the live catalog as a chat-friendly text listing.
 * @param {Array} products - catalog products (from Product.find())
 * @returns {string}
 */
function formatCatalogListing(products) {
  if (products.length === 0) {
    return "We don't have any products listed right now — check back soon.";
  }

  const lines = products
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((p) => {
      const price = (p.price_paise / 100).toFixed(2);
      const unit = p.unit && p.unit !== "unit" ? `/${p.unit}` : "";
      return `• ${p.name} — ₹${price}${unit}`;
    });

  return `Here's what we have:\n${lines.join("\n")}\n\nJust tell me what you'd like, e.g. "2kg rice and 1 oil".`;
}

module.exports = { parseMessage, isCatalogQuery, formatCatalogListing };
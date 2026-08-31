// controllers/agent.controller.js
const Product = require("../models/Product");
const { parseMessage, isCatalogQuery, formatCatalogListing } = require("../services/parser.service");
const { buildCartDraft } = require("../services/cart.service");
const { logEvent } = require("../services/audit.service");

/**
 * POST /agent/turn
 * body: { conversationId, message }
 *
 * Takes a customer message and does one of three things:
 *   1. If it's a "what do you have" style question, lists the catalog
 *      (no cart, no charge).
 *   2. If it parses into items, builds a priced cart draft for the UI
 *      to show as a confirm card.
 *   3. Otherwise, asks for clarification.
 *
 * This route NEVER creates a Razorpay order or charges anything —
 * that only happens in /checkout/confirm, gated by cart_hash.
 *
 * Every branch returns a "reply" text field — the single source of
 * truth for what the assistant says, so the client doesn't need to
 * reconstruct message text itself.
 */
async function handleAgentTurn(req, res, next) {
  try {
    const { conversationId, message } = req.body;

    if (!conversationId || !message || typeof message !== "string") {
      return res.status(400).json({
        ok: false,
        error: "conversationId and message (string) are required"
      });
    }

    await logEvent(conversationId, "message_received", { message });

    const products = await Product.find({});

    // --- branch 1: catalog listing query ---
    if (isCatalogQuery(message)) {
      await logEvent(conversationId, "catalog_listed", {
        productCount: products.length
      });

      return res.status(200).json({
        ok: true,
        understood: true,
        reply: formatCatalogListing(products),
        cart: null
      });
    }

    const parsed = parseMessage(message, products);

    // --- branch 2: nothing matched ---
    if (parsed.items.length === 0) {
      await logEvent(conversationId, "intent_parse_failed", {
        message,
        unmatched: parsed.unmatched
      });

      return res.status(200).json({
        ok: true,
        understood: false,
        reply: parsed.notes
          ? `I couldn't match: ${parsed.unmatched.join(", ")}. Could you rephrase, e.g. "2kg rice"? Or ask "what do you have?" to see the full list.`
          : "Sorry, I didn't catch any items in that. Try something like '2kg rice and 1 oil', or ask \"what do you have?\"",
        cart: null
      });
    }

    // --- branch 3: cart drafted ---
    await logEvent(conversationId, "intent_parsed", {
      message,
      items: parsed.items
    });

    const { cartDraft, outOfStock } = await buildCartDraft(
      conversationId,
      parsed.items
    );

    await logEvent(conversationId, "cart_drafted", {
      cartDraftId: cartDraft._id,
      cart_hash: cartDraft.cart_hash,
      total_paise: cartDraft.total_paise,
      outOfStock
    });

    return res.status(200).json({
      ok: true,
      understood: true,
      reply: `Here's your cart — ₹${(cartDraft.total_paise / 100).toFixed(2)}. Confirm to proceed.`,
      cart: {
        cartDraftId: cartDraft._id,
        items: cartDraft.items,
        total_paise: cartDraft.total_paise,
        cart_hash: cartDraft.cart_hash,
        expires_at: cartDraft.expires_at
      },
      outOfStock,
      notes: parsed.notes || null
    });
  } catch (error) {
    next(error);
  }
}

module.exports = { handleAgentTurn };
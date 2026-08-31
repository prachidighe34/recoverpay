// sockets/assistant.socket.js
const Message = require("../models/Message");
const Product = require("../models/Product");
const { parseMessage, isCatalogQuery, formatCatalogListing } = require("../services/parser.service");
const { buildCartDraft } = require("../services/cart.service");
const { logEvent } = require("../services/audit.service");

module.exports = function (io) {
  io.on("connection", (socket) => {
    console.log("[socket] client connected:", socket.id);

    // client emits: newChat { conversationId, message }
    socket.on("newChat", async ({ conversationId, message }) => {
      try {
        if (!conversationId || !message) {
          return socket.emit("chatError", { error: "conversationId and message are required" });
        }

        await Message.create({ conversationId, sender: "customer", text: message });
        await logEvent(conversationId, "message_received", { message });

        const products = await Product.find({});

        // catalog listing query — no cart, no charge
        if (isCatalogQuery(message)) {
          await logEvent(conversationId, "catalog_listed", { productCount: products.length });

          const listingText = formatCatalogListing(products);
          await Message.create({ conversationId, sender: "assistant", text: listingText });

          return socket.emit("loadNewChat", {
            conversationId, sender: "assistant", text: listingText, cart: null
          });
        }

        const parsed = parseMessage(message, products);

        if (parsed.items.length === 0) {
          await logEvent(conversationId, "intent_parse_failed", { message, unmatched: parsed.unmatched });

          const reply = parsed.notes
            ? `I couldn't match: ${parsed.unmatched.join(", ")}. Try something like "2kg rice", or ask "what do you have?"`
            : "Sorry, I didn't catch any items. Try something like '2kg rice and 1 oil', or ask \"what do you have?\"";

          await Message.create({ conversationId, sender: "assistant", text: reply });

          return socket.emit("loadNewChat", {
            conversationId, sender: "assistant", text: reply, cart: null
          });
        }

        await logEvent(conversationId, "intent_parsed", { message, items: parsed.items });

        const { cartDraft, outOfStock } = await buildCartDraft(conversationId, parsed.items);

        await logEvent(conversationId, "cart_drafted", {
          cartDraftId: cartDraft._id, cart_hash: cartDraft.cart_hash,
          total_paise: cartDraft.total_paise, outOfStock
        });

        const assistantMsg = await Message.create({
          conversationId, sender: "assistant",
          text: `Here's your cart — ₹${(cartDraft.total_paise / 100).toFixed(2)}. Confirm to proceed.`,
          cartDraftId: cartDraft._id
        });

        socket.emit("loadNewChat", {
          conversationId,
          sender: "assistant",
          text: assistantMsg.text,
          cart: {
            cartDraftId: cartDraft._id,
            items: cartDraft.items,
            total_paise: cartDraft.total_paise,
            cart_hash: cartDraft.cart_hash,
            expires_at: cartDraft.expires_at
          },
          outOfStock
        });
      } catch (error) {
        console.error("[socket] newChat error:", error.message);
        socket.emit("chatError", { error: "Something went wrong, please try again" });
      }
    });

    socket.on("disconnect", () => {
      console.log("[socket] client disconnected:", socket.id);
    });
  });
};
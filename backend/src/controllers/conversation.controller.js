// controllers/conversation.controller.js
const Conversation = require("../models/Conversation");

// POST /conversations — creates a new chat session for the logged-in customer
async function createConversation(req, res, next) {
  try {
    const conversation = await Conversation.create({
      customerId: req.user.id,
      type: "assistant",
      status: "open"
    });

    res.status(201).json({
      ok: true,
      conversation: { id: conversation._id, status: conversation.status }
    });
  } catch (error) {
    next(error);
  }
}

// GET /conversations — lists the logged-in customer's past conversations
async function listConversations(req, res, next) {
  try {
    const conversations = await Conversation.find({ customerId: req.user.id })
      .sort({ createdAt: -1 })
      .lean();

    res.json({
      ok: true,
      conversations: conversations.map((c) => ({
        id: c._id, status: c.status, createdAt: c.createdAt
      }))
    });
  } catch (error) {
    next(error);
  }
}

module.exports = { createConversation, listConversations };
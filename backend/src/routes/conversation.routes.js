// routes/conversation.routes.js
const express = require("express");
const authMiddleware = require("../middleware/auth.middleware");
const { createConversation, listConversations } = require("../controllers/conversation.controller");

const router = express.Router();

router.post("/", authMiddleware, createConversation);
router.get("/", authMiddleware, listConversations);

module.exports = router;
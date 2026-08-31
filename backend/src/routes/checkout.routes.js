// routes/checkout.routes.js
const express = require("express");
const authMiddleware = require("../middleware/auth.middleware");
const requireIdempotencyKey = require("../middleware/idempotency.middleware");
const { confirm, verify } = require("../controllers/checkout.controller");

const router = express.Router();

router.post("/confirm", authMiddleware, requireIdempotencyKey, confirm);
router.post("/verify", authMiddleware, verify);

module.exports = router;
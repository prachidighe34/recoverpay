const express = require("express");
const { getAuditTrail } = require("../controllers/audit.controller");

const router = express.Router();

router.get("/:conversationId", getAuditTrail);

module.exports = router;
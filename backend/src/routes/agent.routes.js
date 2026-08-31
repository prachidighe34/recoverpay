const express = require("express");
const { handleAgentTurn } = require("../controllers/agent.controller");

const router = express.Router();

router.post("/turn", handleAgentTurn);

module.exports = router;
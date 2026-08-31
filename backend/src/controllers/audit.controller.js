// controllers/audit.controller.js
const AuditLog = require("../models/AuditLog");

// GET /audit/:conversationId
async function getAuditTrail(req, res, next) {
  try {
    const { conversationId } = req.params;

    const logs = await AuditLog.find({ conversationId })
      .sort({ createdAt: 1 })
      .lean();

    res.json({
      ok: true,
      conversationId,
      count: logs.length,
      trail: logs.map((log) => ({
        event: log.event,
        payload: log.payload,
        at: log.createdAt
      }))
    });
  } catch (error) {
    next(error);
  }
}

module.exports = { getAuditTrail };
// services/audit.service.js
const AuditLog = require("../models/AuditLog");

/**
 * @param {string} conversationId
 * @param {string} event - must be one of AuditLog's AUDIT_EVENTS
 * @param {Object} payload - snapshot relevant to this event
 */
async function logEvent(conversationId, event, payload = {}) {
  try {
    await AuditLog.create({ conversationId, event, payload });
  } catch (error) {
    // Audit logging must never crash the main flow — log and move on.
    console.error("[audit] failed to write log:", error.message);
  }
}

module.exports = { logEvent };
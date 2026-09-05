/**
 * Usage: router.post("/catalog", authMiddleware, requireRole("merchant"), handler)
 * Must run AFTER authMiddleware so req.user is set.
 */
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ ok: false, error: "Not authenticated" });
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ ok: false, error: "Forbidden for this role" });
    }
    next();
  };
}

module.exports = requireRole;
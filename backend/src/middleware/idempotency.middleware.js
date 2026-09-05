/**
 * Ensures every checkout-confirm request carries an idempotency_key.
 * The actual duplicate-prevention guarantee is the unique index on
 * Order.idempotency_key — this middleware just fails fast with a
 * clear error instead of letting a missing key reach Mongo as a
 * confusing validation error.
 */
function requireIdempotencyKey(req, res, next) {
  const { idempotency_key } = req.body;

  if (!idempotency_key || typeof idempotency_key !== "string") {
    return res.status(400).json({
      ok: false,
      error: "idempotency_key is required"
    });
  }

  next();
}

module.exports = requireIdempotencyKey;
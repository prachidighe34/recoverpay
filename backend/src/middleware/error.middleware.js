function errorMiddleware(err, req, res, next) {
  console.error("[error]", err.code || err.message, "-", err.message);

  // Mongo's own duplicate-key error (numeric code 11000) — safety net in
  // case a duplicate idempotency_key ever reaches Order.create() without
  // being caught earlier in checkout.service.js.
  if (err.code === 11000) {
    return res.status(409).json({
      ok: false,
      code: "DUPLICATE_CONFIRM",
      error: "Duplicate request — this order was already processed",
      field: Object.keys(err.keyPattern || {})[0]
    });
  }

  const status = err.status || 500;
  const payload = {
    ok: false,
    code: err.code || "INTERNAL_ERROR",
    error: err.message || "Internal server error"
  };
  if (err.details) payload.details = err.details;

  res.status(status).json(payload);
}

module.exports = errorMiddleware;
// middleware/error.middleware.js
// Central error handler — mount this LAST, after all routes.

function errorMiddleware(err, req, res, next) {
  console.error("[error]", err.message);

  const status = err.status || 500;
  const payload = {
    ok: false,
    error: err.message || "Internal server error",
  };

  // Surface Mongo duplicate-key errors (e.g. idempotency_key clash) clearly
  if (err.code === 11000) {
    return res.status(409).json({
      ok: false,
      error: "Duplicate request — this order was already processed",
      field: Object.keys(err.keyPattern || {})[0],
    });
  }

  res.status(status).json(payload);
}

module.exports = errorMiddleware;

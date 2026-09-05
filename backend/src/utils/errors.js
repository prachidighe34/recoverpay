class AppError extends Error {
  constructor(message, status = 500, code = "INTERNAL_ERROR", details = undefined) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

class NotFoundError extends AppError {
  constructor(message = "Resource not found", code = "NOT_FOUND", details) {
    super(message, 404, code, details);
  }
}

class ConflictError extends AppError {
  constructor(message = "Conflict", code = "CONFLICT", details) {
    super(message, 409, code, details);
  }
}

class ExpiredError extends AppError {
  constructor(message = "Resource expired", code = "EXPIRED", details) {
    super(message, 410, code, details);
  }
}

class ValidationError extends AppError {
  constructor(message = "Invalid request", code = "VALIDATION_ERROR", details) {
    super(message, 400, code, details);
  }
}

// --- checkout-specific error codes -----------------------------------
// Distinct codes for every checkout failure mode, so automated tests and
// the demo video can assert on `code` rather than matching message text.

class CartNotFoundError extends NotFoundError {
  constructor(details) {
    super("Cart not found", "CART_NOT_FOUND", details);
  }
}

class CartExpiredError extends ExpiredError {
  constructor(details) {
    super("Cart expired — please confirm again", "CART_EXPIRED", details);
  }
}

class CartHashMismatchError extends ConflictError {
  constructor(details) {
    super("The cart you confirmed does not match the latest cart", "CART_HASH_MISMATCH", details);
  }
}

class PriceChangedError extends ConflictError {
  constructor(details) {
    super("One or more prices changed since this cart was drafted", "PRICE_CHANGED", details);
  }
}

class OutOfStockError extends ConflictError {
  constructor(details) {
    super("One or more items are no longer in stock", "OUT_OF_STOCK", details);
  }
}

class PaymentVerificationError extends ValidationError {
  constructor(details) {
    super("Payment verification failed — not charged", "PAYMENT_VERIFICATION_FAILED", details);
  }
}

module.exports = {
  AppError, NotFoundError, ConflictError, ExpiredError, ValidationError,
  CartNotFoundError, CartExpiredError, CartHashMismatchError,
  PriceChangedError, OutOfStockError, PaymentVerificationError
};
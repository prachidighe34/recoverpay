// utils/errors.js
// Consistent error shape across all services — error.middleware.js already
// reads err.status and err.message, this just makes throwing them cleaner
// than manually setting `.status` on a plain Error each time.

class AppError extends Error {
  constructor(message, status = 500) {
    super(message);
    this.status = status;
  }
}

class NotFoundError extends AppError {
  constructor(message = "Resource not found") {
    super(message, 404);
  }
}

class ConflictError extends AppError {
  constructor(message = "Conflict") {
    super(message, 409);
  }
}

class ExpiredError extends AppError {
  constructor(message = "Resource expired") {
    super(message, 410);
  }
}

class ValidationError extends AppError {
  constructor(message = "Invalid request") {
    super(message, 400);
  }
}

module.exports = { AppError, NotFoundError, ConflictError, ExpiredError, ValidationError };
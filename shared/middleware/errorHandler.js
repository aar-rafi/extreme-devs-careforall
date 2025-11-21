const logger = require('../utils/logger');
const { errorResponse } = require('../utils/response');

/**
 * Global error handling middleware
 * Must be registered last in the middleware chain
 */
function errorHandler(err, req, res, next) {
  logger.error('Error occurred', {
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
  });

  // Handle validation errors
  if (err.isJoi || err.name === 'ValidationError') {
    return errorResponse(
      res,
      'Validation failed',
      400,
      'VALIDATION_ERROR',
      err.details || err.message
    );
  }

  // Handle JWT errors
  if (err.name === 'JsonWebTokenError') {
    return errorResponse(res, 'Invalid token', 401, 'INVALID_TOKEN');
  }

  if (err.name === 'TokenExpiredError') {
    return errorResponse(res, 'Token expired', 401, 'TOKEN_EXPIRED');
  }

  // Handle database errors
  if (err.code === '23505') {
    // Unique constraint violation
    return errorResponse(res, 'Resource already exists', 409, 'DUPLICATE_RESOURCE');
  }

  if (err.code === '23503') {
    // Foreign key violation
    return errorResponse(res, 'Referenced resource not found', 404, 'RESOURCE_NOT_FOUND');
  }

  // Handle custom application errors
  if (err.statusCode) {
    return errorResponse(res, err.message, err.statusCode, err.code || 'APPLICATION_ERROR');
  }

  // Default to 500 internal server error
  return errorResponse(
    res,
    process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
    500,
    'INTERNAL_ERROR'
  );
}

/**
 * Custom application error class
 */
class AppError extends Error {
  constructor(message, statusCode = 500, code = 'APPLICATION_ERROR') {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = {
  errorHandler,
  AppError,
};

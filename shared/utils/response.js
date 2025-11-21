const { v4: uuidv4 } = require('uuid');

/**
 * Standard success response
 * @param {Object} res Express response object
 * @param {*} data Response data
 * @param {number} statusCode HTTP status code
 * @param {Object} meta Additional metadata
 */
function successResponse(res, data, statusCode = 200, meta = {}) {
  return res.status(statusCode).json({
    success: true,
    data,
    meta: {
      timestamp: new Date().toISOString(),
      requestId: res.locals.requestId || uuidv4(),
      ...meta,
    },
  });
}

/**
 * Standard error response
 * @param {Object} res Express response object
 * @param {string} message Error message
 * @param {number} statusCode HTTP status code
 * @param {string} code Error code
 * @param {Object} details Additional error details
 */
function errorResponse(res, message, statusCode = 500, code = 'INTERNAL_ERROR', details = {}) {
  return res.status(statusCode).json({
    success: false,
    error: {
      code,
      message,
      details,
    },
    meta: {
      timestamp: new Date().toISOString(),
      requestId: res.locals.requestId || uuidv4(),
    },
  });
}

/**
 * Paginated response
 * @param {Object} res Express response object
 * @param {Array} data Response data
 * @param {Object} pagination Pagination info { page, limit, total }
 */
function paginatedResponse(res, data, pagination) {
  const { page, limit, total } = pagination;
  const totalPages = Math.ceil(total / limit);

  return res.status(200).json({
    success: true,
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    },
    meta: {
      timestamp: new Date().toISOString(),
      requestId: res.locals.requestId || uuidv4(),
    },
  });
}

module.exports = {
  successResponse,
  errorResponse,
  paginatedResponse,
};

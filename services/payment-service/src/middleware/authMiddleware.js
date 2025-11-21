const axios = require('axios');
const { logger } = require('@careforall/shared');
const { AppError } = require('@careforall/shared/middleware/errorHandler');

const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || 'http://auth-service:3001';

/**
 * Optional authentication middleware
 * Tries to authenticate but doesn't fail if no token provided
 */
async function optionalAuth(req, res, next) {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      // No token provided, continue without user
      req.user = null;
      return next();
    }

    // Verify token with auth service
    const response = await axios.get(`${AUTH_SERVICE_URL}/api/auth/verify`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (response.data.success) {
      req.user = response.data.data.user;
    } else {
      req.user = null;
    }

    next();
  } catch (error) {
    // If verification fails, continue without user
    logger.warn('Optional auth failed', { error: error.message });
    req.user = null;
    next();
  }
}

/**
 * Required authentication middleware
 * Fails if no valid token provided
 */
async function requireAuth(req, res, next) {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      throw new AppError('Authentication required', 401, 'UNAUTHORIZED');
    }

    // Verify token with auth service
    const response = await axios.get(`${AUTH_SERVICE_URL}/api/auth/verify`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.data.success) {
      throw new AppError('Invalid token', 401, 'UNAUTHORIZED');
    }

    req.user = response.data.data.user;
    next();
  } catch (error) {
    if (error instanceof AppError) {
      return next(error);
    }
    logger.error('Auth verification failed', { error: error.message });
    next(new AppError('Authentication failed', 401, 'UNAUTHORIZED'));
  }
}

module.exports = {
  optionalAuth,
  requireAuth,
};

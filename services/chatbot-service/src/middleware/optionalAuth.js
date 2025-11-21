/**
 * Optional Authentication Middleware
 * Verifies JWT token if provided, but allows anonymous access
 */

const axios = require('axios');
const { logger } = require('@careforall/shared');

const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || 'http://auth-service:3001';

const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    // If no auth header, continue as anonymous
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      req.user = null;
      return next();
    }

    const token = authHeader.substring(7);

    // Verify token with auth service
    try {
      const response = await axios.get(`${AUTH_SERVICE_URL}/api/auth/verify`, {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 3000
      });

      if (response.data && response.data.data) {
        req.user = response.data.data.user;
        logger.info(`Authenticated user: ${req.user.id}`);
      } else {
        req.user = null;
      }
    } catch (authError) {
      // Token verification failed, continue as anonymous
      logger.warn('Token verification failed, continuing as anonymous');
      req.user = null;
    }

    next();
  } catch (error) {
    logger.error('Error in optionalAuth middleware:', error);
    // Don't block the request, continue as anonymous
    req.user = null;
    next();
  }
};

module.exports = optionalAuth;

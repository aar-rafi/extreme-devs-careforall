const jwt = require('jsonwebtoken');
const { logger } = require('@careforall/shared');

/**
 * Middleware to require admin authentication
 * Verifies JWT token and checks for ADMIN role
 */
function requireAdmin(req, res, next) {
  try {
    // Extract token from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Verify JWT token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Check if user has ADMIN role
    if (decoded.role !== 'ADMIN') {
      logger.warn('Non-admin user attempted to access admin endpoint', {
        userId: decoded.userId,
        role: decoded.role,
        path: req.path,
      });
      return res.status(403).json({ error: 'Admin access required' });
    }

    // Attach user info to request
    req.user = {
      userId: decoded.userId,
      email: decoded.email,
      role: decoded.role,
    };

    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid token' });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }

    logger.error('Error in requireAdmin middleware', { error: error.message });
    return res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = requireAdmin;

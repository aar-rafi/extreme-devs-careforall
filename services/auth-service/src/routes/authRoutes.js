const express = require('express');
const authController = require('../controllers/authController');
const { verifyToken } = require('../middleware/authMiddleware');
const rateLimit = require('express-rate-limit');

const router = express.Router();

// Rate limiting for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 requests per window
  message: 'Too many authentication attempts, please try again later',
});

const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per window
});

// Public routes
router.post('/register', authLimiter, authController.register.bind(authController));
router.post('/login', authLimiter, authController.login.bind(authController));
router.post('/refresh', generalLimiter, authController.refresh.bind(authController));
router.post('/logout', generalLimiter, authController.logout.bind(authController));

// Internal route (for API Gateway)
router.get('/verify', generalLimiter, authController.verify.bind(authController));

// Protected routes
router.get('/profile', verifyToken, authController.getProfile.bind(authController));
router.put('/profile', verifyToken, authController.updateProfile.bind(authController));

module.exports = router;

const express = require('express');
const router = express.Router();
const pledgeController = require('../controllers/pledgeController');
const { verifyToken, optionalAuth } = require('../middleware/authMiddleware');

// Create pledge - supports both authenticated and anonymous users
router.post('/', optionalAuth, pledgeController.createPledge);

// Get pledge by ID - supports optional auth (for payment verification)
router.get('/:id', optionalAuth, pledgeController.getPledgeById);

// These routes require authentication
router.get('/', verifyToken, pledgeController.getUserPledges);
router.get('/campaign/:campaignId', verifyToken, pledgeController.getPledgesByCampaign);
router.patch('/:id/cancel', verifyToken, pledgeController.cancelPledge);

module.exports = router;

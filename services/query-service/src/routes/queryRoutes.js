const express = require('express');
const router = express.Router();
const queryController = require('../controllers/queryController');
const { verifyToken, optionalAuth } = require('../middleware/authMiddleware');

// Public routes
router.get('/campaigns/:id/stats', queryController.getCampaignStats);
router.get('/campaigns/trending', queryController.getTrendingCampaigns);
router.get('/platform/stats', queryController.getPlatformStats);
router.get('/donations/recent', queryController.getRecentDonations);
router.get('/campaigns/:campaignId/donations', queryController.getCampaignDonations);
router.get('/donors/top', queryController.getTopDonors);

// Protected routes - require authentication
router.get('/users/:id/stats', verifyToken, queryController.getUserStats);
router.get('/users/:userId/donations', verifyToken, queryController.getUserDonationHistory);

module.exports = router;

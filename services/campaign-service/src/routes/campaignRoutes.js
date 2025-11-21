const express = require('express');
const router = express.Router();
const campaignController = require('../controllers/campaignController');
const { verifyToken } = require('../middleware/authMiddleware');

// Public routes
router.get('/', campaignController.getAllCampaigns);
router.get('/search', campaignController.searchCampaigns);
router.get('/:id', campaignController.getCampaignById);

// Protected routes - require authentication
router.post('/', verifyToken, campaignController.createCampaign);
router.put('/:id', verifyToken, campaignController.updateCampaign);
router.patch('/:id/status', verifyToken, campaignController.updateCampaignStatus);
router.delete('/:id', verifyToken, campaignController.deleteCampaign);

// Organizer-specific routes
router.get('/organizer/:organizerId', verifyToken, campaignController.getCampaignsByOrganizer);

module.exports = router;

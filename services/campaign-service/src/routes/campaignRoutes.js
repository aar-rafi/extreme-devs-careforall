const express = require('express');
const router = express.Router();
const campaignController = require('../controllers/campaignController');
const { verifyToken } = require('../middleware/authMiddleware');

// Public routes
router.get('/', campaignController.getAllCampaigns);
router.get('/search', campaignController.searchCampaigns);
router.get('/:id', campaignController.getCampaignById);

// Protected routes - DEMO MODE: Auth bypassed for frontend demo
router.post('/', campaignController.createCampaign);
router.put('/:id', campaignController.updateCampaign);
router.patch('/:id/status', campaignController.updateCampaignStatus);
router.delete('/:id', campaignController.deleteCampaign);

// Organizer-specific routes
router.get('/organizer/:organizerId', campaignController.getCampaignsByOrganizer);

module.exports = router;

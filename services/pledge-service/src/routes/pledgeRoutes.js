const express = require('express');
const router = express.Router();
const pledgeController = require('../controllers/pledgeController');
const { verifyToken } = require('../middleware/authMiddleware');

// All pledge routes require authentication
router.use(verifyToken);

router.post('/', pledgeController.createPledge);
router.get('/', pledgeController.getUserPledges);
router.get('/:id', pledgeController.getPledgeById);
router.get('/campaign/:campaignId', pledgeController.getPledgesByCampaign);
router.patch('/:id/cancel', pledgeController.cancelPledge);

module.exports = router;

const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const webhookController = require('../controllers/webhookController');
const { optionalAuth, requireAuth } = require('../middleware/authMiddleware');
const { idempotencyMiddleware } = require('../middleware/idempotencyMiddleware');

// Payment initiation - requires idempotency key
router.post('/initiate', optionalAuth, idempotencyMiddleware, paymentController.initiatePayment);

// Webhook endpoints - PUBLIC (no auth, SSL Commerz will call these)
router.post('/webhook/success', webhookController.handleSuccess);
router.post('/webhook/fail', webhookController.handleFailure);
router.post('/webhook/cancel', webhookController.handleCancel);
router.post('/webhook/ipn', webhookController.handleIPN);

// Payment queries
router.get('/:id', requireAuth, paymentController.getPaymentById);
router.get('/pledge/:pledgeId', requireAuth, paymentController.getPaymentByPledgeId);
router.get('/transaction/:transactionId', requireAuth, paymentController.getPaymentByTransactionId);

// Payment validation (verify with SSL Commerz)
router.post('/:id/validate', requireAuth, paymentController.validatePayment);

// Admin operations
router.post('/:id/refund', requireAuth, paymentController.refundPayment);

module.exports = router;

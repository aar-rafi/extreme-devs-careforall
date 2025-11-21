const express = require('express');
const { logger } = require('@careforall/shared');
const requireAdmin = require('../middleware/requireAdmin');

const dashboardService = require('../services/dashboardService');
const campaignAdminService = require('../services/campaignAdminService');
const userAdminService = require('../services/userAdminService');
const paymentAdminService = require('../services/paymentAdminService');
const auditService = require('../services/auditService');

const router = express.Router();

// All routes require admin authentication
router.use(requireAdmin);

// ============================================================================
// Dashboard Routes
// ============================================================================

/**
 * GET /api/admin/dashboard/stats
 * Get platform-wide statistics
 */
router.get('/dashboard/stats', async (req, res) => {
  try {
    const stats = await dashboardService.getStats();
    res.json(stats);
  } catch (error) {
    logger.error('Failed to get dashboard stats', { error: error.message });
    res.status(500).json({ error: 'Failed to get dashboard statistics' });
  }
});

/**
 * GET /api/admin/dashboard/trending-campaigns
 * Get trending campaigns
 */
router.get('/dashboard/trending-campaigns', async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    const campaigns = await dashboardService.getTrendingCampaigns(parseInt(limit));
    res.json({ campaigns });
  } catch (error) {
    logger.error('Failed to get trending campaigns', { error: error.message });
    res.status(500).json({ error: 'Failed to get trending campaigns' });
  }
});

/**
 * GET /api/admin/dashboard/recent-actions
 * Get recent admin actions
 */
router.get('/dashboard/recent-actions', async (req, res) => {
  try {
    const { limit = 20 } = req.query;
    const actions = await dashboardService.getRecentAdminActions(parseInt(limit));
    res.json({ actions });
  } catch (error) {
    logger.error('Failed to get recent actions', { error: error.message });
    res.status(500).json({ error: 'Failed to get recent actions' });
  }
});

// ============================================================================
// Campaign Management Routes
// ============================================================================

/**
 * GET /api/admin/campaigns
 * List all campaigns
 */
router.get('/campaigns', async (req, res) => {
  try {
    const { status, campaignType, search, limit, offset } = req.query;
    const result = await campaignAdminService.listCampaigns({
      status,
      campaignType,
      search,
      limit: limit ? parseInt(limit) : undefined,
      offset: offset ? parseInt(offset) : undefined,
    });
    res.json(result);
  } catch (error) {
    logger.error('Failed to list campaigns', { error: error.message });
    res.status(500).json({ error: 'Failed to list campaigns' });
  }
});

/**
 * GET /api/admin/campaigns/:id
 * Get campaign details
 */
router.get('/campaigns/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await campaignAdminService.getCampaignDetails(id);
    res.json(result);
  } catch (error) {
    logger.error('Failed to get campaign details', { error: error.message });
    res.status(error.message === 'Campaign not found' ? 404 : 500).json({ error: error.message });
  }
});

/**
 * PATCH /api/admin/campaigns/:id/approve
 * Approve a campaign
 */
router.patch('/campaigns/:id/approve', async (req, res) => {
  try {
    const { id } = req.params;
    const adminId = req.user.userId;
    const ipAddress = req.ip;
    const userAgent = req.headers['user-agent'];

    const result = await campaignAdminService.approveCampaign(id, adminId, ipAddress, userAgent);
    res.json(result);
  } catch (error) {
    logger.error('Failed to approve campaign', { error: error.message });
    res.status(error.message.includes('not found') ? 404 : 400).json({ error: error.message });
  }
});

/**
 * PATCH /api/admin/campaigns/:id/reject
 * Reject a campaign
 */
router.patch('/campaigns/:id/reject', async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    if (!reason) {
      return res.status(400).json({ error: 'Rejection reason is required' });
    }

    const adminId = req.user.userId;
    const ipAddress = req.ip;
    const userAgent = req.headers['user-agent'];

    const result = await campaignAdminService.rejectCampaign(id, adminId, reason, ipAddress, userAgent);
    res.json(result);
  } catch (error) {
    logger.error('Failed to reject campaign', { error: error.message });
    res.status(error.message.includes('not found') ? 404 : 400).json({ error: error.message });
  }
});

// ============================================================================
// User Management Routes
// ============================================================================

/**
 * GET /api/admin/users
 * List all users
 */
router.get('/users', async (req, res) => {
  try {
    const { role, isActive, search, limit, offset } = req.query;
    const result = await userAdminService.listUsers({
      role,
      isActive: isActive !== undefined ? isActive === 'true' : undefined,
      search,
      limit: limit ? parseInt(limit) : undefined,
      offset: offset ? parseInt(offset) : undefined,
    });
    res.json(result);
  } catch (error) {
    logger.error('Failed to list users', { error: error.message });
    res.status(500).json({ error: 'Failed to list users' });
  }
});

/**
 * GET /api/admin/users/:id
 * Get user details
 */
router.get('/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await userAdminService.getUserDetails(id);
    res.json(result);
  } catch (error) {
    logger.error('Failed to get user details', { error: error.message });
    res.status(error.message === 'User not found' ? 404 : 500).json({ error: error.message });
  }
});

/**
 * PATCH /api/admin/users/:id/status
 * Update user active status
 */
router.patch('/users/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { isActive, reason } = req.body;

    if (typeof isActive !== 'boolean') {
      return res.status(400).json({ error: 'isActive must be a boolean' });
    }

    const adminId = req.user.userId;
    const ipAddress = req.ip;
    const userAgent = req.headers['user-agent'];

    const result = await userAdminService.updateUserStatus(
      id,
      isActive,
      adminId,
      reason,
      ipAddress,
      userAgent
    );
    res.json(result);
  } catch (error) {
    logger.error('Failed to update user status', { error: error.message });
    res.status(error.message.includes('not found') ? 404 : 400).json({ error: error.message });
  }
});

// ============================================================================
// Payment Management Routes
// ============================================================================

/**
 * GET /api/admin/payments
 * List all payments
 */
router.get('/payments', async (req, res) => {
  try {
    const { status, paymentMethod, startDate, endDate, limit, offset } = req.query;
    const result = await paymentAdminService.listPayments({
      status,
      paymentMethod,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      limit: limit ? parseInt(limit) : undefined,
      offset: offset ? parseInt(offset) : undefined,
    });
    res.json(result);
  } catch (error) {
    logger.error('Failed to list payments', { error: error.message });
    res.status(500).json({ error: 'Failed to list payments' });
  }
});

/**
 * GET /api/admin/payments/:id
 * Get payment details
 */
router.get('/payments/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await paymentAdminService.getPaymentDetails(id);
    res.json(result);
  } catch (error) {
    logger.error('Failed to get payment details', { error: error.message });
    res.status(error.message === 'Payment not found' ? 404 : 500).json({ error: error.message });
  }
});

/**
 * POST /api/admin/payments/:id/refund
 * Refund a payment
 */
router.post('/payments/:id/refund', async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    if (!reason) {
      return res.status(400).json({ error: 'Refund reason is required' });
    }

    const adminId = req.user.userId;
    const ipAddress = req.ip;
    const userAgent = req.headers['user-agent'];

    const result = await paymentAdminService.refundPayment(id, adminId, reason, ipAddress, userAgent);
    res.json(result);
  } catch (error) {
    logger.error('Failed to refund payment', { error: error.message });
    res.status(error.message.includes('not found') ? 404 : 400).json({ error: error.message });
  }
});

// ============================================================================
// Audit Log Routes
// ============================================================================

/**
 * GET /api/admin/audit-logs
 * Get audit logs
 */
router.get('/audit-logs', async (req, res) => {
  try {
    const { adminId, action, entityType, entityId, startDate, endDate, limit, offset } = req.query;
    const result = await auditService.getAuditLogs({
      adminId,
      action,
      entityType,
      entityId,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      limit: limit ? parseInt(limit) : undefined,
      offset: offset ? parseInt(offset) : undefined,
    });
    res.json(result);
  } catch (error) {
    logger.error('Failed to get audit logs', { error: error.message });
    res.status(500).json({ error: 'Failed to get audit logs' });
  }
});

module.exports = router;

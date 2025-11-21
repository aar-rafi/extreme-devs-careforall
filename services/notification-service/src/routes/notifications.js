const express = require('express');
const { logger } = require('@careforall/shared');
const { getPool } = require('@careforall/shared/database/pool');
const pushService = require('../services/pushService');
const emailService = require('../services/emailService');

const router = express.Router();

/**
 * GET /api/notifications/vapid-public-key
 * Get VAPID public key for push subscription
 */
router.get('/vapid-public-key', (req, res) => {
  try {
    const publicKey = pushService.getPublicKey();
    res.json({ publicKey });
  } catch (error) {
    logger.error('Failed to get VAPID public key', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/notifications/subscribe
 * Subscribe to push notifications
 * Body: { subscription: PushSubscription, userId: string }
 */
router.post('/subscribe', async (req, res) => {
  try {
    const { subscription, userId } = req.body;

    if (!subscription || !userId) {
      return res.status(400).json({ error: 'subscription and userId are required' });
    }

    const userAgent = req.headers['user-agent'];
    await pushService.subscribe(subscription, userId, userAgent);

    res.json({ success: true, message: 'Subscribed to push notifications' });
  } catch (error) {
    logger.error('Failed to subscribe to push notifications', { error: error.message });
    res.status(500).json({ error: 'Failed to subscribe to push notifications' });
  }
});

/**
 * POST /api/notifications/unsubscribe
 * Unsubscribe from push notifications
 * Body: { endpoint: string }
 */
router.post('/unsubscribe', async (req, res) => {
  try {
    const { endpoint } = req.body;

    if (!endpoint) {
      return res.status(400).json({ error: 'endpoint is required' });
    }

    await pushService.unsubscribe(endpoint);

    res.json({ success: true, message: 'Unsubscribed from push notifications' });
  } catch (error) {
    logger.error('Failed to unsubscribe from push notifications', { error: error.message });
    res.status(500).json({ error: 'Failed to unsubscribe from push notifications' });
  }
});

/**
 * GET /api/notifications/history/:userId
 * Get notification history for a user
 */
router.get('/history/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { limit = 50, offset = 0, type } = req.query;

    const pool = getPool();

    let query = `
      SELECT * FROM notifications.notification_history
      WHERE recipient_user_id = $1
    `;
    const params = [userId];

    // Filter by notification type if provided
    if (type) {
      query += ` AND notification_type = $${params.length + 1}`;
      params.push(type);
    }

    query += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(parseInt(limit), parseInt(offset));

    const result = await pool.query(query, params);

    // Get total count
    let countQuery = `
      SELECT COUNT(*) FROM notifications.notification_history
      WHERE recipient_user_id = $1
    `;
    const countParams = [userId];

    if (type) {
      countQuery += ` AND notification_type = $2`;
      countParams.push(type);
    }

    const countResult = await pool.query(countQuery, countParams);
    const total = parseInt(countResult.rows[0].count);

    res.json({
      notifications: result.rows,
      total,
      limit: parseInt(limit),
      offset: parseInt(offset),
    });
  } catch (error) {
    logger.error('Failed to get notification history', { error: error.message });
    res.status(500).json({ error: 'Failed to get notification history' });
  }
});

/**
 * GET /api/notifications/subscriptions/:userId
 * Get push subscriptions for a user
 */
router.get('/subscriptions/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const pool = getPool();

    const result = await pool.query(
      `SELECT id, endpoint, user_agent, is_active, created_at, updated_at
       FROM notifications.push_subscriptions
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [userId]
    );

    res.json({ subscriptions: result.rows });
  } catch (error) {
    logger.error('Failed to get push subscriptions', { error: error.message });
    res.status(500).json({ error: 'Failed to get push subscriptions' });
  }
});

/**
 * POST /api/notifications/test/email
 * Send a test email (for development/testing)
 * Body: { to: string, templateName: string, templateData: object }
 */
router.post('/test/email', async (req, res) => {
  try {
    const { to, templateName, templateData } = req.body;

    if (!to || !templateName) {
      return res.status(400).json({ error: 'to and templateName are required' });
    }

    const result = await emailService.sendEmail({
      to,
      subject: `Test Email - ${templateName}`,
      templateName,
      templateData: templateData || {},
      eventType: 'test.email',
      eventId: `test-${Date.now()}`,
    });

    res.json({ success: true, result });
  } catch (error) {
    logger.error('Failed to send test email', { error: error.message });
    res.status(500).json({ error: 'Failed to send test email' });
  }
});

/**
 * POST /api/notifications/test/push
 * Send a test push notification (for development/testing)
 * Body: { userId: string, title: string, body: string }
 */
router.post('/test/push', async (req, res) => {
  try {
    const { userId, title, body } = req.body;

    if (!userId || !title || !body) {
      return res.status(400).json({ error: 'userId, title, and body are required' });
    }

    const result = await pushService.sendToUser(
      userId,
      {
        title,
        body,
        icon: '/icon-192x192.png',
        url: '/',
      },
      'test.push',
      `test-${Date.now()}`
    );

    res.json({ success: true, result });
  } catch (error) {
    logger.error('Failed to send test push notification', { error: error.message });
    res.status(500).json({ error: 'Failed to send test push notification' });
  }
});

/**
 * GET /api/notifications/stats
 * Get notification statistics
 */
router.get('/stats', async (req, res) => {
  try {
    const pool = getPool();

    const result = await pool.query(`
      SELECT
        notification_type,
        status,
        COUNT(*) as count
      FROM notifications.notification_history
      WHERE created_at >= NOW() - INTERVAL '30 days'
      GROUP BY notification_type, status
      ORDER BY notification_type, status
    `);

    // Get active subscriptions count
    const subsResult = await pool.query(`
      SELECT COUNT(*) as active_subscriptions
      FROM notifications.push_subscriptions
      WHERE is_active = true
    `);

    res.json({
      stats: result.rows,
      activeSubscriptions: parseInt(subsResult.rows[0].active_subscriptions),
    });
  } catch (error) {
    logger.error('Failed to get notification stats', { error: error.message });
    res.status(500).json({ error: 'Failed to get notification stats' });
  }
});

module.exports = router;

const webpush = require('web-push');
const { logger } = require('@careforall/shared');
const { getPool } = require('@careforall/shared/database/pool');

class PushService {
  constructor() {
    this.vapidKeys = null;
  }

  /**
   * Initialize Web Push with VAPID keys
   */
  async initialize() {
    try {
      // VAPID keys should be generated once and stored in environment variables
      // Generate with: webpush.generateVAPIDKeys()
      const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
      const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
      const vapidSubject = process.env.VAPID_SUBJECT || 'mailto:admin@careforall.com';

      if (!vapidPublicKey || !vapidPrivateKey) {
        logger.warn('VAPID keys not configured. Push notifications will be disabled.');
        return;
      }

      webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);

      this.vapidKeys = {
        publicKey: vapidPublicKey,
        privateKey: vapidPrivateKey,
      };

      logger.info('Push notification service initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize push service', { error: error.message });
      throw error;
    }
  }

  /**
   * Get VAPID public key for client-side subscription
   * @returns {string} VAPID public key
   */
  getPublicKey() {
    if (!this.vapidKeys) {
      throw new Error('Push service not initialized. VAPID keys not configured.');
    }
    return this.vapidKeys.publicKey;
  }

  /**
   * Subscribe a user to push notifications
   * @param {Object} subscription - Push subscription object from browser
   * @param {string} userId - User ID
   * @param {string} userAgent - Browser user agent
   */
  async subscribe(subscription, userId, userAgent) {
    const pool = getPool();

    try {
      // Store subscription in database
      await pool.query(
        `INSERT INTO notifications.push_subscriptions (
          user_id, endpoint, p256dh, auth, user_agent, is_active
        ) VALUES ($1, $2, $3, $4, $5, true)
        ON CONFLICT (endpoint) DO UPDATE SET
          user_id = EXCLUDED.user_id,
          p256dh = EXCLUDED.p256dh,
          auth = EXCLUDED.auth,
          user_agent = EXCLUDED.user_agent,
          is_active = true,
          updated_at = NOW()`,
        [
          userId,
          subscription.endpoint,
          subscription.keys.p256dh,
          subscription.keys.auth,
          userAgent,
        ]
      );

      logger.info('User subscribed to push notifications', { userId, endpoint: subscription.endpoint });
      return { success: true };
    } catch (error) {
      logger.error('Failed to subscribe user to push notifications', {
        userId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Unsubscribe a user from push notifications
   * @param {string} endpoint - Push subscription endpoint
   */
  async unsubscribe(endpoint) {
    const pool = getPool();

    try {
      await pool.query(
        `UPDATE notifications.push_subscriptions
         SET is_active = false, updated_at = NOW()
         WHERE endpoint = $1`,
        [endpoint]
      );

      logger.info('User unsubscribed from push notifications', { endpoint });
      return { success: true };
    } catch (error) {
      logger.error('Failed to unsubscribe user', { endpoint, error: error.message });
      throw error;
    }
  }

  /**
   * Send push notification to a specific user
   * @param {string} userId - User ID
   * @param {Object} notification - Notification payload
   * @param {string} notification.title - Notification title
   * @param {string} notification.body - Notification body
   * @param {string} notification.icon - Notification icon URL
   * @param {string} notification.url - URL to open when notification is clicked
   * @param {Object} notification.data - Additional data
   * @param {string} eventType - Event type that triggered the notification
   * @param {string} eventId - Event ID (for deduplication)
   */
  async sendToUser(userId, notification, eventType, eventId) {
    const pool = getPool();

    try {
      // Get all active subscriptions for the user
      const result = await pool.query(
        `SELECT * FROM notifications.push_subscriptions
         WHERE user_id = $1 AND is_active = true`,
        [userId]
      );

      const subscriptions = result.rows;

      if (subscriptions.length === 0) {
        logger.info('No active push subscriptions for user', { userId });
        return { success: true, sent: 0 };
      }

      // Send notification to all user's devices
      const sendPromises = subscriptions.map((sub) =>
        this.sendToSubscription(sub, notification, eventType, eventId, userId)
      );

      const results = await Promise.allSettled(sendPromises);

      // Count successful sends
      const successCount = results.filter((r) => r.status === 'fulfilled' && r.value.success).length;

      logger.info('Push notifications sent to user', {
        userId,
        totalSubscriptions: subscriptions.length,
        successfulSends: successCount,
      });

      return { success: true, sent: successCount };
    } catch (error) {
      logger.error('Failed to send push notification to user', {
        userId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Send push notification to a specific subscription
   * @private
   */
  async sendToSubscription(subscription, notification, eventType, eventId, userId) {
    const pool = getPool();
    const notificationId = require('uuid').v4();

    if (!this.vapidKeys) {
      logger.warn('Push service not initialized. Skipping push notification.');
      return { success: false, reason: 'not_initialized' };
    }

    try {
      // Check for duplicate event_id
      if (eventId) {
        const duplicateCheck = await pool.query(
          `SELECT id FROM notifications.notification_history
           WHERE event_type = $1 AND event_id = $2 AND recipient_user_id = $3
             AND notification_type = 'push' AND status = 'sent'
           LIMIT 1`,
          [eventType, eventId, userId]
        );

        if (duplicateCheck.rows.length > 0) {
          logger.info('Duplicate push notification prevented', { eventType, eventId, userId });
          return { success: false, reason: 'duplicate', notificationId: duplicateCheck.rows[0].id };
        }
      }

      // Insert notification record with pending status
      await pool.query(
        `INSERT INTO notifications.notification_history (
          id, notification_type, event_type, event_id, recipient_user_id,
          subject, template_data, status
        ) VALUES ($1, 'push', $2, $3, $4, $5, $6, 'pending')`,
        [
          notificationId,
          eventType,
          eventId,
          userId,
          notification.title,
          JSON.stringify(notification),
        ]
      );

      // Prepare push subscription object
      const pushSubscription = {
        endpoint: subscription.endpoint,
        keys: {
          p256dh: subscription.p256dh,
          auth: subscription.auth,
        },
      };

      // Send push notification
      const payload = JSON.stringify({
        title: notification.title,
        body: notification.body,
        icon: notification.icon || '/icon-192x192.png',
        badge: notification.badge || '/badge-72x72.png',
        url: notification.url || '/',
        data: notification.data || {},
      });

      await webpush.sendNotification(pushSubscription, payload);

      // Update notification record with success
      await pool.query(
        `UPDATE notifications.notification_history
         SET status = 'sent', sent_at = NOW(), updated_at = NOW()
         WHERE id = $1`,
        [notificationId]
      );

      logger.info('Push notification sent successfully', {
        notificationId,
        userId,
        endpoint: subscription.endpoint,
      });

      return { success: true, notificationId };
    } catch (error) {
      // Handle subscription errors (expired, invalid, etc.)
      if (error.statusCode === 410 || error.statusCode === 404) {
        // Subscription is no longer valid - deactivate it
        await pool.query(
          `UPDATE notifications.push_subscriptions
           SET is_active = false, updated_at = NOW()
           WHERE endpoint = $1`,
          [subscription.endpoint]
        );

        logger.info('Push subscription expired and deactivated', {
          endpoint: subscription.endpoint,
        });
      }

      // Update notification record with failure
      await pool.query(
        `UPDATE notifications.notification_history
         SET status = 'failed', error_message = $1, updated_at = NOW()
         WHERE id = $2`,
        [error.message, notificationId]
      );

      logger.error('Failed to send push notification', {
        notificationId,
        userId,
        error: error.message,
        statusCode: error.statusCode,
      });

      return { success: false, error: error.message };
    }
  }

  /**
   * Send campaign update notification
   */
  async sendCampaignUpdate(userId, campaign, updateMessage) {
    return this.sendToUser(
      userId,
      {
        title: 'Campaign Update',
        body: `${campaign.title}: ${updateMessage}`,
        icon: campaign.image_url,
        url: `/campaigns/${campaign.id}`,
        data: { campaignId: campaign.id, type: 'campaign_update' },
      },
      'campaign.update',
      `campaign-update-${campaign.id}-${Date.now()}`
    );
  }

  /**
   * Send new donation notification
   */
  async sendNewDonationNotification(userId, campaign, donorName, amount) {
    return this.sendToUser(
      userId,
      {
        title: 'New Donation Received!',
        body: `${donorName} donated ${amount} BDT to ${campaign.title}`,
        icon: '/icons/donation.png',
        url: `/dashboard/campaigns/${campaign.id}`,
        data: { campaignId: campaign.id, type: 'new_donation' },
      },
      'pledge.completed',
      `donation-notification-${campaign.id}-${Date.now()}`
    );
  }

  /**
   * Send campaign goal reached notification
   */
  async sendGoalReachedNotification(userId, campaign) {
    return this.sendToUser(
      userId,
      {
        title: 'Campaign Goal Reached! 🎉',
        body: `Congratulations! ${campaign.title} has reached its funding goal!`,
        icon: campaign.image_url,
        url: `/campaigns/${campaign.id}`,
        data: { campaignId: campaign.id, type: 'goal_reached' },
      },
      'campaign.goal_reached',
      campaign.id
    );
  }
}

module.exports = new PushService();

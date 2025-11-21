/**
 * Event types used across the platform
 */
const EVENTS = {
  // Pledge events
  PLEDGE_CREATED: 'pledge.created',
  PLEDGE_PAYMENT_INITIATED: 'pledge.payment_initiated',
  PLEDGE_COMPLETED: 'pledge.completed',
  PLEDGE_FAILED: 'pledge.failed',
  PLEDGE_REFUNDED: 'pledge.refunded',

  // Payment events
  PAYMENT_PENDING: 'payment.pending',
  PAYMENT_AUTHORIZED: 'payment.authorized',
  PAYMENT_CAPTURED: 'payment.captured',
  PAYMENT_COMPLETED: 'payment.completed',
  PAYMENT_FAILED: 'payment.failed',
  PAYMENT_REFUNDED: 'payment.refunded',

  // Campaign events
  CAMPAIGN_CREATED: 'campaign.created',
  CAMPAIGN_UPDATED: 'campaign.updated',
  CAMPAIGN_ACTIVATED: 'campaign.activated',
  CAMPAIGN_GOAL_REACHED: 'campaign.goal_reached',
  CAMPAIGN_EXPIRED: 'campaign.expired',

  // Notification events
  SEND_EMAIL: 'notification.send_email',
  SEND_SMS: 'notification.send_sms',
};

/**
 * Queue names
 */
const QUEUES = {
  PLEDGE_EVENTS: 'pledge-events',
  PAYMENT_EVENTS: 'payment-events',
  CAMPAIGN_EVENTS: 'campaign-events',
  NOTIFICATION_EVENTS: 'notification-events',
  QUERY_UPDATES: 'query-updates',
};

module.exports = {
  EVENTS,
  QUEUES,
};

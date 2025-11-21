const { createConsumer, logger, QUEUES, EVENTS } = require('@careforall/shared');
const { getPool } = require('@careforall/shared/database/pool');
const emailService = require('../services/emailService');
const pushService = require('../services/pushService');

/**
 * Handle campaign.goal_reached event - Notify organizer
 */
async function handleCampaignGoalReached(eventData) {
  const { campaign_id, goal_amount, current_amount } = eventData;
  const pool = getPool();

  try {
    // Fetch campaign and organizer details
    const result = await pool.query(
      `SELECT c.*, up.first_name, up.last_name, u.email as organizer_email,
              ct.donor_count
       FROM campaigns.campaigns c
       JOIN auth.users u ON c.organizer_id = u.id
       LEFT JOIN auth.user_profiles up ON u.id = up.user_id
       LEFT JOIN query.campaign_totals ct ON c.id = ct.campaign_id
       WHERE c.id = $1`,
      [campaign_id]
    );

    if (result.rows.length === 0) {
      logger.warn('Campaign not found for goal reached notification', { campaignId: campaign_id });
      return;
    }

    const campaign = result.rows[0];

    // 1. Send congratulations email to organizer
    await emailService.sendCampaignGoalReached({
      campaign: {
        id: campaign_id,
        title: campaign.title,
        goal_amount: goal_amount,
        donor_count: campaign.donor_count || 0,
      },
      organizer: {
        id: campaign.organizer_id,
        email: campaign.organizer_email,
        first_name: campaign.first_name,
      },
    });

    // 2. Send push notification to organizer
    await pushService.sendGoalReachedNotification(campaign.organizer_id, {
      id: campaign_id,
      title: campaign.title,
      image_url: campaign.image_url,
    });

    logger.info('Campaign goal reached notifications sent', {
      campaignId: campaign_id,
      organizerId: campaign.organizer_id,
    });
  } catch (error) {
    logger.error('Error handling campaign.goal_reached notification', {
      error: error.message,
      campaignId: campaign_id,
    });
    throw error;
  }
}

/**
 * Handle campaign.created event - Send welcome email to organizer
 */
async function handleCampaignCreated(eventData) {
  const { campaign_id, organizer_id } = eventData;
  const pool = getPool();

  try {
    // Fetch organizer details
    const result = await pool.query(
      `SELECT u.email, up.first_name
       FROM auth.users u
       LEFT JOIN auth.user_profiles up ON u.id = up.user_id
       WHERE u.id = $1`,
      [organizer_id]
    );

    if (result.rows.length === 0) {
      logger.warn('Organizer not found for campaign creation notification', { organizerId: organizer_id });
      return;
    }

    const organizer = result.rows[0];

    // Send campaign creation confirmation (could use a dedicated template)
    logger.info('Campaign created notification', {
      campaignId: campaign_id,
      organizerId: organizer_id,
    });

    // Note: You can add a dedicated campaign creation email template here if needed
  } catch (error) {
    logger.error('Error handling campaign.created notification', {
      error: error.message,
      campaignId: campaign_id,
    });
    // Don't throw - this is not critical
  }
}

/**
 * Start campaign event consumer
 */
function startCampaignConsumer() {
  logger.info('Starting notification campaign event consumer');

  createConsumer(QUEUES.CAMPAIGN_EVENTS, async (job) => {
    const { eventType, data } = job.data;

    switch (eventType) {
      case EVENTS.CAMPAIGN_GOAL_REACHED:
        await handleCampaignGoalReached(data);
        break;
      case EVENTS.CAMPAIGN_CREATED:
        await handleCampaignCreated(data);
        break;
      default:
        logger.debug('Campaign event not handled by notification service', { eventType });
    }
  });
}

module.exports = { startCampaignConsumer };

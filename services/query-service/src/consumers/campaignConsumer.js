const { createConsumer, logger, QUEUES, EVENTS } = require('@careforall/shared');
const { getPool } = require('@careforall/shared/database/pool');

async function handleCampaignCreated(eventData) {
  const { campaign_id, organizer_id, title, campaign_type, goal_amount } = eventData;
  const pool = getPool();

  try {
    // Initialize campaign_totals record with correct column names
    await pool.query(
      `INSERT INTO query.campaign_totals (
        campaign_id, title, campaign_type, goal_amount, raised_amount, donor_count, status
      ) VALUES ($1, $2, $3, $4, 0, 0, 'active')
      ON CONFLICT (campaign_id) DO NOTHING`,
      [campaign_id, title, campaign_type, goal_amount]
    );

    logger.info('Campaign created in read model', { campaignId: campaign_id });
  } catch (error) {
    logger.error('Error handling campaign.created', { error: error.message, campaignId: campaign_id });
    throw error; // Re-throw to trigger retry
  }
}

async function handleCampaignUpdated(eventData) {
  const { campaign_id } = eventData;
  logger.info('Campaign updated event received', { campaignId: campaign_id });
  // Additional logic can be added here if needed
}

async function handleCampaignGoalReached(eventData) {
  const { campaign_id, goal_amount, current_amount } = eventData;
  const pool = getPool();

  try {
    await pool.query(
      `UPDATE query.campaign_totals
       SET goal_reached_at = NOW()
       WHERE campaign_id = $1 AND goal_reached_at IS NULL`,
      [campaign_id]
    );

    logger.info('Campaign goal reached recorded', { campaignId: campaign_id });
  } catch (error) {
    logger.error('Error handling campaign.goal_reached', { error: error.message });
    throw error;
  }
}

function startCampaignConsumer() {
  logger.info('Starting campaign event consumer');

  // Create a single consumer for the campaign-events queue
  // Route to appropriate handler based on event type
  createConsumer(QUEUES.CAMPAIGN_EVENTS, async (job) => {
    const { eventType, data } = job.data;

    switch (eventType) {
      case EVENTS.CAMPAIGN_CREATED:
        await handleCampaignCreated(data);
        break;
      case EVENTS.CAMPAIGN_UPDATED:
        await handleCampaignUpdated(data);
        break;
      case EVENTS.CAMPAIGN_GOAL_REACHED:
        await handleCampaignGoalReached(data);
        break;
      default:
        logger.warn('Unknown campaign event type', { eventType });
    }
  });
}

module.exports = { startCampaignConsumer };

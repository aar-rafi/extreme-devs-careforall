/**
 * Campaign Event Consumer
 * Subscribes to campaign events and updates knowledge base
 */

const { startConsumer, EVENTS, QUEUES, logger } = require('@careforall/shared');
const knowledgeBase = require('../services/knowledgeBase');

/**
 * Process campaign events
 */
async function processCampaignEvent(job) {
  try {
    const { eventType, data } = job.data;

    logger.info(`Processing campaign event: ${eventType}`, { campaignId: data.id });

    switch (eventType) {
      case EVENTS.CAMPAIGN_CREATED:
      case EVENTS.CAMPAIGN_UPDATED:
      case EVENTS.CAMPAIGN_ACTIVATED:
        // Update knowledge base with campaign information
        await knowledgeBase.updateCampaignKnowledge({
          id: data.id,
          name: data.name || data.title,
          description: data.description,
          goal: data.goal,
          raised: data.raised || data.current_amount || 0,
          language: data.language || 'en'
        });
        logger.info(`Knowledge base updated for campaign ${data.id}`);
        break;

      case EVENTS.CAMPAIGN_GOAL_REACHED:
        logger.info(`Campaign ${data.id} reached its goal!`);
        // Could send notifications or update cache here
        await knowledgeBase.clearCache(); // Force refresh
        break;

      case EVENTS.CAMPAIGN_EXPIRED:
        logger.info(`Campaign ${data.id} has expired`);
        await knowledgeBase.clearCache(); // Force refresh
        break;

      default:
        logger.info(`Unhandled campaign event: ${eventType}`);
    }
  } catch (error) {
    logger.error('Error processing campaign event:', error);
    throw error; // Let BullMQ handle retries
  }
}

/**
 * Start campaign event consumer
 */
async function startCampaignConsumer() {
  try {
    logger.info('Starting campaign event consumer...');

    await startConsumer(
      QUEUES.CAMPAIGN_EVENTS,
      processCampaignEvent,
      {
        concurrency: 5, // Process up to 5 events concurrently
        limiter: {
          max: 10,
          duration: 1000 // Max 10 jobs per second
        }
      }
    );

    logger.info('✅ Campaign event consumer started successfully');
  } catch (error) {
    logger.error('❌ Failed to start campaign event consumer:', error);
    throw error;
  }
}

module.exports = { startCampaignConsumer, processCampaignEvent };

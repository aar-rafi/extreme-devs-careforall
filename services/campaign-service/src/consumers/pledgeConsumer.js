const { createConsumer, QUEUES, EVENTS, logger } = require('@careforall/shared');
const campaignService = require('../services/campaignService');

/**
 * Handle pledge.completed to increment campaign current_amount
 */
async function handlePledgeCompleted(eventData) {
  const { pledge_id, campaign_id, amount } = eventData;

  try {
    if (!campaign_id || !amount) {
      logger.warn('Missing campaign_id or amount in pledge.completed', { pledge_id, campaign_id, amount });
      return;
    }

    await campaignService.updateCampaignAmount(campaign_id, Number(amount));
    logger.info('Campaign amount incremented from pledge.completed', {
      campaign_id,
      pledge_id,
      amount,
    });
  } catch (error) {
    logger.error('Error handling pledge.completed in campaign-service', {
      error: error.message,
      campaign_id,
      pledge_id,
    });
    throw error;
  }
}

async function processPledgeEvent(job) {
  const { eventType, data } = job.data;
  logger.info('Campaign service received pledge event', { eventType, eventId: job.data.eventId });

  switch (eventType) {
    case EVENTS.PLEDGE_COMPLETED:
      await handlePledgeCompleted(data);
      break;
    default:
      logger.info('Unhandled pledge event type in campaign-service', { eventType });
  }
}

function startPledgeConsumer() {
  const worker = createConsumer(QUEUES.PLEDGE_EVENTS, processPledgeEvent, { concurrency: 5 });
  logger.info('Campaign service pledge consumer started');
  return worker;
}

module.exports = { startPledgeConsumer };



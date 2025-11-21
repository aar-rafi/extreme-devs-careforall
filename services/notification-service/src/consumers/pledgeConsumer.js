const { createConsumer, logger, QUEUES, EVENTS } = require('@careforall/shared');
const { getPool } = require('@careforall/shared/database/pool');
const emailService = require('../services/emailService');
const pushService = require('../services/pushService');

/**
 * Handle pledge.created event - Send pledge confirmation to donor
 */
async function handlePledgeCreated(eventData) {
  const { pledge_id, campaign_id, user_id, donor_email, donor_name, amount, currency } = eventData;
  const pool = getPool();

  try {
    // Fetch campaign details
    const campaignResult = await pool.query(
      'SELECT * FROM campaigns.campaigns WHERE id = $1',
      [campaign_id]
    );

    if (campaignResult.rows.length === 0) {
      logger.warn('Campaign not found for pledge notification', { campaignId: campaign_id });
      return;
    }

    const campaign = campaignResult.rows[0];

    // Send pledge confirmation email to donor
    await emailService.sendPledgeConfirmation({
      pledge: {
        id: pledge_id,
        donor_email,
        donor_name,
        amount,
        currency: currency || 'BDT',
      },
      campaign: {
        id: campaign_id,
        title: campaign.title,
      },
      user: user_id ? { id: user_id } : null,
    });

    logger.info('Pledge confirmation sent', { pledgeId: pledge_id, donorEmail: donor_email });
  } catch (error) {
    logger.error('Error handling pledge.created notification', {
      error: error.message,
      pledgeId: pledge_id,
    });
    throw error; // Re-throw to trigger retry
  }
}

/**
 * Handle pledge.completed event - Send donation success notification and notify organizer
 */
async function handlePledgeCompleted(eventData) {
  const {
    pledge_id,
    campaign_id,
    user_id,
    donor_email,
    donor_name,
    amount,
    currency,
    is_anonymous,
    message,
  } = eventData;
  const pool = getPool();

  try {
    // Fetch campaign and organizer details
    const campaignResult = await pool.query(
      `SELECT c.*, up.first_name, up.last_name, u.email as organizer_email
       FROM campaigns.campaigns c
       JOIN auth.users u ON c.organizer_id = u.id
       LEFT JOIN auth.user_profiles up ON u.id = up.user_id
       WHERE c.id = $1`,
      [campaign_id]
    );

    if (campaignResult.rows.length === 0) {
      logger.warn('Campaign not found for pledge completion notification', { campaignId: campaign_id });
      return;
    }

    const campaign = campaignResult.rows[0];

    // Fetch payment details if available
    const paymentResult = await pool.query(
      'SELECT * FROM payments.payments WHERE pledge_id = $1',
      [pledge_id]
    );

    const payment = paymentResult.rows[0];

    // 1. Send donation success email to donor
    await emailService.sendDonationSuccess({
      pledge: {
        id: pledge_id,
        donor_email,
        donor_name,
        amount,
        currency: currency || 'BDT',
        user_id,
      },
      campaign: {
        id: campaign_id,
        title: campaign.title,
      },
      payment: {
        id: payment?.id,
        transaction_id: payment?.transaction_id || 'N/A',
      },
    });

    // 2. Send new donation notification to campaign organizer
    await emailService.sendNewDonationNotification({
      campaign: {
        id: campaign_id,
        title: campaign.title,
      },
      organizer: {
        id: campaign.organizer_id,
        email: campaign.organizer_email,
        first_name: campaign.first_name,
      },
      pledge: {
        id: pledge_id,
        donor_name,
        amount,
        currency: currency || 'BDT',
        is_anonymous: is_anonymous || false,
        message,
      },
    });

    // 3. Send push notification to organizer
    await pushService.sendNewDonationNotification(
      campaign.organizer_id,
      { id: campaign_id, title: campaign.title },
      is_anonymous ? 'Anonymous' : donor_name,
      amount
    );

    logger.info('Pledge completion notifications sent', {
      pledgeId: pledge_id,
      campaignId: campaign_id,
      organizerId: campaign.organizer_id,
    });
  } catch (error) {
    logger.error('Error handling pledge.completed notification', {
      error: error.message,
      pledgeId: pledge_id,
    });
    throw error;
  }
}

/**
 * Start pledge event consumer
 */
function startPledgeConsumer() {
  logger.info('Starting notification pledge event consumer');

  createConsumer(QUEUES.PLEDGE_EVENTS, async (job) => {
    const { eventType, data } = job.data;

    switch (eventType) {
      case EVENTS.PLEDGE_CREATED:
        await handlePledgeCreated(data);
        break;
      case EVENTS.PLEDGE_COMPLETED:
        await handlePledgeCompleted(data);
        break;
      default:
        logger.debug('Pledge event not handled by notification service', { eventType });
    }
  });
}

module.exports = { startPledgeConsumer };

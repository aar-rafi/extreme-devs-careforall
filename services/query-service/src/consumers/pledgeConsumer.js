const { createConsumer, logger, QUEUES, EVENTS } = require('@careforall/shared');
const { getPool } = require('@careforall/shared/database/pool');

async function handlePledgeCreated(eventData) {
  const { pledge_id, campaign_id, user_id, amount } = eventData;
  const pool = getPool();

  try {
    // Only insert into donation_history to track the pledge/donation attempt
    // Financial stats will be updated when pledge.completed event fires (after payment succeeds)
    await pool.query(
      `INSERT INTO query.donation_history (
        pledge_id, campaign_id, donor_id, amount, donated_at
      ) VALUES ($1, $2, $3, $4, NOW())
      ON CONFLICT (pledge_id) DO NOTHING`,
      [pledge_id, campaign_id, user_id, amount]
    );

    logger.info('Pledge created in donation history', { pledgeId: pledge_id, campaignId: campaign_id });
  } catch (error) {
    logger.error('Error handling pledge.created', { error: error.message, pledgeId: pledge_id });
    throw error;
  }
}

async function handlePledgeCompleted(eventData) {
  const { pledge_id, campaign_id, user_id, amount } = eventData;
  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Update campaign_totals with completed donation
    await client.query(
      `UPDATE query.campaign_totals
       SET raised_amount = raised_amount + $1,
           donor_count = donor_count + 1,
           last_donation_at = NOW(),
           updated_at = NOW()
       WHERE campaign_id = $2`,
      [amount, campaign_id]
    );

    // Update user_statistics
    await client.query(
      `INSERT INTO query.user_statistics (
        user_id, total_donated, campaigns_supported, donation_count, first_donation_at, last_donation_at
      ) VALUES ($1, $2, 1, 1, NOW(), NOW())
      ON CONFLICT (user_id) DO UPDATE SET
        total_donated = query.user_statistics.total_donated + $2,
        campaigns_supported = query.user_statistics.campaigns_supported + 1,
        donation_count = query.user_statistics.donation_count + 1,
        last_donation_at = NOW(),
        updated_at = NOW()`,
      [user_id, amount]
    );

    // Update platform_statistics
    await client.query(
      `UPDATE query.platform_statistics
       SET total_raised = total_raised + $1,
           total_donations = total_donations + 1,
           updated_at = NOW()
       WHERE id = 1`,
      [amount]
    );

    await client.query('COMMIT');
    logger.info('Pledge completed in read models', { pledgeId: pledge_id });
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Error handling pledge.completed', { error: error.message });
    throw error;
  } finally {
    client.release();
  }
}

async function handlePledgeCancelled(eventData) {
  const { pledge_id } = eventData;
  const pool = getPool();

  try {
    // Remove the donation history record for cancelled pledges
    await pool.query(
      `DELETE FROM query.donation_history WHERE pledge_id = $1`,
      [pledge_id]
    );

    logger.info('Pledge cancelled - removed from donation history', { pledgeId: pledge_id });
  } catch (error) {
    logger.error('Error handling pledge.cancelled', { error: error.message, pledgeId: pledge_id });
    throw error;
  }
}

function startPledgeConsumer() {
  logger.info('Starting pledge event consumer');

  // Create a single consumer for the pledge-events queue
  // Route to appropriate handler based on event type
  createConsumer(QUEUES.PLEDGE_EVENTS, async (job) => {
    const { eventType, data } = job.data;

    switch (eventType) {
      case EVENTS.PLEDGE_CREATED:
        await handlePledgeCreated(data);
        break;
      case EVENTS.PLEDGE_COMPLETED:
        await handlePledgeCompleted(data);
        break;
      case EVENTS.PLEDGE_CANCELLED:
        await handlePledgeCancelled(data);
        break;
      case EVENTS.PLEDGE_FAILED:
        logger.info('Pledge failed event received', data);
        break;
      default:
        logger.warn('Unknown pledge event type', { eventType });
    }
  });
}

module.exports = { startPledgeConsumer };

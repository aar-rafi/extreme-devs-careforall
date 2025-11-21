const { createConsumer, QUEUES, EVENTS, logger, publishEvent } = require('@careforall/shared');
const { getPool } = require('@careforall/shared/database/pool');

/**
 * Payment event consumer
 * Listens to payment events and updates pledge status accordingly
 */

async function handlePaymentCompleted(eventData) {
  const { payment_id, pledge_id, transaction_id, amount } = eventData;

  logger.info('Handling payment completed event', {
    payment_id,
    pledge_id,
    transaction_id,
  });

  const pool = getPool();

  try {
    // Update pledge status to completed
    const updateQuery = `
      UPDATE pledges.pledges
      SET status = 'completed',
          payment_reference = $1,
          updated_at = NOW()
      WHERE id = $2
      RETURNING *
    `;

    const result = await pool.query(updateQuery, [transaction_id, pledge_id]);

    if (result.rows.length === 0) {
      logger.error('Pledge not found when updating to completed', { pledge_id });
      return;
    }

    const pledge = result.rows[0];

    logger.info('Pledge marked as completed', {
      pledge_id,
      payment_reference: transaction_id,
    });

    // Emit pledge.completed so query-service (and campaign-service) can update totals
    try {
      await publishEvent(EVENTS.PLEDGE_COMPLETED, {
        pledge_id,
        campaign_id: pledge.campaign_id,
        user_id: pledge.user_id || null,
        amount: pledge.amount,
      });
      logger.info('Emitted pledge.completed event from payment consumer', { pledge_id });
    } catch (e) {
      logger.error('Failed to emit pledge.completed event', { error: e.message, pledge_id });
      throw e;
    }

    // DEMO fallback: also update base campaign table directly to keep write-side consistent
    if (process.env.DEMO_UPDATE_CAMPAIGN_ON_PAYMENT === 'true') {
      try {
        await pool.query(
          `UPDATE campaigns.campaigns
           SET current_amount = current_amount + $1, updated_at = NOW()
           WHERE id = $2`,
          [Number(pledge.amount), pledge.campaign_id]
        );
        logger.warn('DEMO_UPDATE_CAMPAIGN_ON_PAYMENT: campaigns.current_amount incremented directly', {
          campaign_id: pledge.campaign_id,
          amount: pledge.amount,
        });
      } catch (e) {
        logger.error('Failed to update campaigns.current_amount directly (demo fallback)', {
          error: e.message,
          campaign_id: pledge.campaign_id,
        });
        // do not throw to avoid losing the main completion flow
      }
    }

    // Note: Pledge service will emit pledge.completed event via its outbox
    // which will be consumed by query service and notification service
  } catch (error) {
    logger.error('Error handling payment completed event', {
      error: error.message,
      payment_id,
      pledge_id,
    });
    throw error; // BullMQ will retry
  }
}

async function handlePaymentFailed(eventData) {
  const { payment_id, pledge_id, transaction_id } = eventData;

  logger.info('Handling payment failed event', {
    payment_id,
    pledge_id,
    transaction_id,
  });

  const pool = getPool();

  try {
    // Update pledge status to failed
    const updateQuery = `
      UPDATE pledges.pledges
      SET status = 'failed',
          payment_reference = $1,
          updated_at = NOW()
      WHERE id = $2
      RETURNING *
    `;

    const result = await pool.query(updateQuery, [transaction_id, pledge_id]);

    if (result.rows.length === 0) {
      logger.error('Pledge not found when updating to failed', { pledge_id });
      return;
    }

    logger.info('Pledge marked as failed', {
      pledge_id,
      payment_reference: transaction_id,
    });
  } catch (error) {
    logger.error('Error handling payment failed event', {
      error: error.message,
      payment_id,
      pledge_id,
    });
    throw error;
  }
}

async function handlePaymentRefunded(eventData) {
  const { payment_id, pledge_id, transaction_id } = eventData;

  logger.info('Handling payment refunded event', {
    payment_id,
    pledge_id,
    transaction_id,
  });

  const pool = getPool();

  try {
    // Update pledge status to refunded
    const updateQuery = `
      UPDATE pledges.pledges
      SET status = 'refunded',
          updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `;

    const result = await pool.query(updateQuery, [pledge_id]);

    if (result.rows.length === 0) {
      logger.error('Pledge not found when updating to refunded', { pledge_id });
      return;
    }

    logger.info('Pledge marked as refunded', {
      pledge_id,
      payment_reference: transaction_id,
    });

    // Note: Query service will need to decrement campaign totals
  } catch (error) {
    logger.error('Error handling payment refunded event', {
      error: error.message,
      payment_id,
      pledge_id,
    });
    throw error;
  }
}

/**
 * Main event processor
 */
async function processPaymentEvent(job) {
  const { eventType, data } = job.data;

  logger.info('Processing payment event', { eventType, eventId: job.data.eventId });

  switch (eventType) {
    case EVENTS.PAYMENT_COMPLETED:
      await handlePaymentCompleted(data);
      break;

    case EVENTS.PAYMENT_COMPLETE:
      // Unified completion signal; for demo we may force completion even if status != 'completed'
      if (data && data.status === 'completed') {
        logger.info('payment.complete received for already completed payment - skipping duplicate');
      } else if (process.env.DEMO_FORCE_PLEDGE_COMPLETE === 'true') {
        logger.warn('Forcing pledge completion on payment.complete (demo mode)');
        await handlePaymentCompleted(data);
      } else {
        logger.info('payment.complete received but not forcing pledge completion (status != completed)');
      }
      break;

    case EVENTS.PAYMENT_FAILED:
      await handlePaymentFailed(data);
      break;

    case EVENTS.PAYMENT_REFUNDED:
      await handlePaymentRefunded(data);
      break;

    default:
      logger.info('Unhandled payment event type', { eventType });
  }
}

/**
 * Start payment event consumer
 */
function startPaymentConsumer() {
  const worker = createConsumer(QUEUES.PAYMENT_EVENTS, processPaymentEvent, {
    concurrency: 5,
  });

  logger.info('Payment event consumer started');

  return worker;
}

module.exports = {
  startPaymentConsumer,
  handlePaymentCompleted,
  handlePaymentFailed,
  handlePaymentRefunded,
};

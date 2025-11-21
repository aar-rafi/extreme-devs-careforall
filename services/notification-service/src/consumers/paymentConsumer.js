const { createConsumer, logger, QUEUES, EVENTS } = require('@careforall/shared');
const { getPool } = require('@careforall/shared/database/pool');

/**
 * Handle payment.completed event
 * Note: Most notification logic is in pledge.completed handler
 * This is mainly for payment-specific notifications if needed
 */
async function handlePaymentCompleted(eventData) {
  const { payment_id, pledge_id, transaction_id, amount } = eventData;

  try {
    logger.info('Payment completed event received', {
      paymentId: payment_id,
      pledgeId: pledge_id,
      transactionId: transaction_id,
    });

    // Most notifications are handled by pledge.completed event
    // This handler is here for payment-specific notifications if needed in the future
    // For example: payment receipt generation, tax documentation, etc.
  } catch (error) {
    logger.error('Error handling payment.completed notification', {
      error: error.message,
      paymentId: payment_id,
    });
    // Don't throw - this is not critical
  }
}

/**
 * Handle payment.failed event - Notify donor about payment failure
 */
async function handlePaymentFailed(eventData) {
  const { payment_id, pledge_id, error_message } = eventData;
  const pool = getPool();

  try {
    // Fetch pledge details
    const result = await pool.query(
      'SELECT * FROM pledges.pledges WHERE id = $1',
      [pledge_id]
    );

    if (result.rows.length === 0) {
      logger.warn('Pledge not found for payment failed notification', { pledgeId: pledge_id });
      return;
    }

    const pledge = result.rows[0];

    logger.info('Payment failed notification', {
      paymentId: payment_id,
      pledgeId: pledge_id,
      donorEmail: pledge.donor_email,
    });

    // Note: You can add a dedicated payment failure email template here if needed
    // For now, just logging the failure
  } catch (error) {
    logger.error('Error handling payment.failed notification', {
      error: error.message,
      paymentId: payment_id,
    });
    // Don't throw - this is not critical
  }
}

/**
 * Start payment event consumer
 */
function startPaymentConsumer() {
  logger.info('Starting notification payment event consumer');

  createConsumer(QUEUES.PAYMENT_EVENTS, async (job) => {
    const { eventType, data } = job.data;

    switch (eventType) {
      case EVENTS.PAYMENT_COMPLETED:
        await handlePaymentCompleted(data);
        break;
      case EVENTS.PAYMENT_FAILED:
        await handlePaymentFailed(data);
        break;
      default:
        logger.debug('Payment event not handled by notification service', { eventType });
    }
  });
}

module.exports = { startPaymentConsumer };

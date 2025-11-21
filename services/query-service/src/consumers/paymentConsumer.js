const { createConsumer, logger, QUEUES, EVENTS } = require('@careforall/shared');

async function handlePaymentCompleted(eventData) {
  const { payment_id, pledge_id, amount } = eventData;
  logger.info('Payment completed event received', { paymentId: payment_id, pledgeId: pledge_id });
  // Payment completion triggers pledge.completed which updates read models
}

async function handlePaymentFailed(eventData) {
  const { payment_id, pledge_id } = eventData;
  logger.info('Payment failed event received', { paymentId: payment_id, pledgeId: pledge_id });
  // Payment failure triggers pledge.failed which can update read models if needed
}

function startPaymentConsumer() {
  logger.info('Starting payment event consumer');

  // Create a single consumer for the payment-events queue
  // Route to appropriate handler based on event type
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
        logger.warn('Unknown payment event type', { eventType });
    }
  });
}

module.exports = { startPaymentConsumer };

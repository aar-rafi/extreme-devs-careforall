const { getPool } = require('@careforall/shared/database/pool');
const { publishEvent, logger } = require('@careforall/shared');

const BATCH_SIZE = 100;
const POLL_INTERVAL_MS = 5000; // Poll every 5 seconds
const MAX_RETRIES = 3;

let isProcessing = false;
let intervalId = null;

async function processOutbox() {
  if (isProcessing) {
    return; // Skip if already processing
  }

  isProcessing = true;
  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Lock and fetch unprocessed events
    const query = `
      SELECT * FROM pledges.outbox
      WHERE processed = false
        AND retry_count < $1
      ORDER BY created_at ASC
      LIMIT $2
      FOR UPDATE SKIP LOCKED
    `;

    const result = await client.query(query, [MAX_RETRIES, BATCH_SIZE]);
    const events = result.rows;

    if (events.length === 0) {
      await client.query('COMMIT');
      return;
    }

    logger.info(`Processing ${events.length} outbox events`);

    // Process each event
    for (const event of events) {
      try {
        // Publish the event to BullMQ
        await publishEvent(event.event_type, JSON.parse(event.payload));

        // Mark as processed
        await client.query(
          `UPDATE pledges.outbox
           SET processed = true, processed_at = NOW()
           WHERE id = $1`,
          [event.id]
        );

        logger.info('Outbox event processed', {
          outboxId: event.id,
          eventType: event.event_type,
          aggregateId: event.aggregate_id,
        });
      } catch (error) {
        // Increment retry count on failure
        await client.query(
          `UPDATE pledges.outbox
           SET retry_count = retry_count + 1, last_error = $1
           WHERE id = $2`,
          [error.message, event.id]
        );

        logger.error('Failed to process outbox event', {
          outboxId: event.id,
          error: error.message,
          retryCount: event.retry_count + 1,
        });
      }
    }

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Error in outbox processor', { error: error.message });
  } finally {
    client.release();
    isProcessing = false;
  }
}

function startOutboxProcessor() {
  logger.info('Starting outbox processor');

  // Run immediately on startup
  processOutbox();

  // Then poll at regular intervals
  intervalId = setInterval(processOutbox, POLL_INTERVAL_MS);

  // Cleanup on process termination
  process.on('SIGTERM', stopOutboxProcessor);
  process.on('SIGINT', stopOutboxProcessor);
}

function stopOutboxProcessor() {
  if (intervalId) {
    clearInterval(intervalId);
    logger.info('Outbox processor stopped');
  }
}

module.exports = {
  startOutboxProcessor,
  stopOutboxProcessor,
  processOutbox,
};

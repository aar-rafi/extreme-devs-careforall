const { Queue, Worker } = require('bullmq');
const { v4: uuidv4 } = require('uuid');
const logger = require('./logger');

const connection = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
};

/**
 * Create a BullMQ queue
 * @param {string} queueName Queue name
 * @returns {Queue} BullMQ queue instance
 */
function createQueue(queueName) {
  return new Queue(queueName, { connection });
}

/**
 * Publish an event to a queue
 * @param {Queue} queue Queue instance
 * @param {string} eventType Event type
 * @param {Object} data Event data
 * @param {Object} options Job options
 */
async function publishEvent(queue, eventType, data, options = {}) {
  const eventId = uuidv4();
  const payload = {
    eventId,
    eventType,
    timestamp: new Date().toISOString(),
    data,
  };

  await queue.add(eventType, payload, {
    removeOnComplete: 100,
    removeOnFail: 50,
    ...options,
  });

  logger.info('Event published', { eventType, eventId, queue: queue.name });
  return eventId;
}

/**
 * Create an event consumer (worker)
 * @param {string} queueName Queue name
 * @param {Function} processor Job processor function
 * @param {Object} options Worker options
 * @returns {Worker} BullMQ worker instance
 */
function createConsumer(queueName, processor, options = {}) {
  const worker = new Worker(
    queueName,
    async (job) => {
      logger.info('Processing event', {
        queue: queueName,
        eventType: job.data.eventType,
        eventId: job.data.eventId,
      });

      try {
        await processor(job);
        logger.info('Event processed successfully', {
          queue: queueName,
          eventType: job.data.eventType,
          eventId: job.data.eventId,
        });
      } catch (error) {
        logger.error('Event processing failed', {
          queue: queueName,
          eventType: job.data.eventType,
          eventId: job.data.eventId,
          error: error.message,
        });
        throw error;
      }
    },
    {
      connection,
      concurrency: options.concurrency || 10,
      ...options,
    }
  );

  worker.on('failed', (job, err) => {
    logger.error('Job failed', {
      queue: queueName,
      jobId: job?.id,
      error: err.message,
    });
  });

  logger.info('Event consumer created', { queue: queueName });
  return worker;
}

module.exports = {
  createQueue,
  publishEvent,
  createConsumer,
};

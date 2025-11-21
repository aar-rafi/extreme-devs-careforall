const { Queue, Worker } = require('bullmq');
const { v4: uuidv4 } = require('uuid');
const logger = require('./logger');
const { EVENTS, QUEUES } = require('../config/events');

// Parse Redis connection from REDIS_URL or individual env vars
function getRedisConnection() {
  if (process.env.REDIS_URL) {
    const url = new URL(process.env.REDIS_URL);
    return {
      host: url.hostname,
      port: parseInt(url.port || '6379'),
    };
  }
  return {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
  };
}

const connection = getRedisConnection();

// Queue instances cache
const queues = {};

/**
 * Get or create a queue instance
 * @param {string} queueName Queue name
 * @returns {Queue} BullMQ queue instance
 */
function getQueue(queueName) {
  if (!queues[queueName]) {
    queues[queueName] = new Queue(queueName, { connection });
  }
  return queues[queueName];
}

/**
 * Map event types to their corresponding queues
 */
function getQueueForEvent(eventType) {
  if (eventType.startsWith('pledge.')) return QUEUES.PLEDGE_EVENTS;
  if (eventType.startsWith('payment.')) return QUEUES.PAYMENT_EVENTS;
  if (eventType.startsWith('campaign.')) return QUEUES.CAMPAIGN_EVENTS;
  if (eventType.startsWith('notification.')) return QUEUES.NOTIFICATION_EVENTS;
  return QUEUES.QUERY_UPDATES; // Default queue
}

/**
 * Publish an event
 * @param {string} eventType Event type (e.g., EVENTS.PLEDGE_CREATED)
 * @param {Object} data Event data
 * @param {Object} options Job options
 */
async function publishEvent(eventType, data, options = {}) {
  if (!eventType) {
    throw new Error('Event type must be provided');
  }

  const queueName = getQueueForEvent(eventType);
  const queue = getQueue(queueName);

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

  logger.info('Event published', { eventType, eventId, queue: queueName });
  return eventId;
}

/**
 * Create an event consumer (worker) for a specific queue
 * @param {string} queueName Queue name
 * @param {Function} processor Job processor function (receives job.data.eventType and job.data.data)
 * @param {Object} options Worker options
 * @returns {Worker} BullMQ worker instance
 */
function createConsumer(queueName, processor, options = {}) {
  if (!queueName) {
    throw new Error('Queue name must be provided');
  }

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

/**
 * Create a BullMQ queue (for backward compatibility)
 * @param {string} queueName Queue name
 * @returns {Queue} BullMQ queue instance
 */
function createQueue(queueName) {
  return getQueue(queueName);
}

module.exports = {
  createQueue,
  getQueue,
  publishEvent,
  createConsumer,
};

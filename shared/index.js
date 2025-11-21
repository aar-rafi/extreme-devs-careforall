// Database
const { query, getClient, closePool } = require('./database/pool');
const { cache, getRedisClient, closeRedis } = require('./database/redis');

// Utils
const logger = require('./utils/logger');
const { successResponse, errorResponse, paginatedResponse } = require('./utils/response');
const { createQueue, getQueue, publishEvent, createConsumer } = require('./utils/eventBus');

// Middleware
const { errorHandler, AppError } = require('./middleware/errorHandler');
const requestLogger = require('./middleware/requestLogger');
const {
  metricsMiddleware,
  metricsEndpoint,
  trackDbQuery,
  trackDbPool,
  trackQueueJob,
  trackError,
  metrics
} = require('./middleware/metricsMiddleware');

// Config
const { EVENTS, QUEUES } = require('./config/events');

module.exports = {
  // Database
  query,
  getClient,
  closePool,
  cache,
  getRedisClient,
  closeRedis,

  // Utils
  logger,
  successResponse,
  errorResponse,
  paginatedResponse,
  createQueue,
  getQueue,
  publishEvent,
  createConsumer,

  // Middleware
  errorHandler,
  AppError,
  requestLogger,
  metricsMiddleware,
  metricsEndpoint,
  trackDbQuery,
  trackDbPool,
  trackQueueJob,
  trackError,
  metrics,

  // Config
  EVENTS,
  QUEUES,
};

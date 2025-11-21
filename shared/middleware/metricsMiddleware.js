const client = require('prom-client');

// Create a Registry to register the metrics
const register = new client.Registry();

// Add default metrics (CPU, memory, etc.)
client.collectDefaultMetrics({
  register,
  prefix: 'careforall_',
});

// Custom metrics
const httpRequestDuration = new client.Histogram({
  name: 'careforall_http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code', 'service'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 5, 10],
  registers: [register],
});

const httpRequestTotal = new client.Counter({
  name: 'careforall_http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code', 'service'],
  registers: [register],
});

const httpRequestsInProgress = new client.Gauge({
  name: 'careforall_http_requests_in_progress',
  help: 'Number of HTTP requests currently in progress',
  labelNames: ['method', 'service'],
  registers: [register],
});

const errorCounter = new client.Counter({
  name: 'careforall_errors_total',
  help: 'Total number of errors',
  labelNames: ['type', 'service'],
  registers: [register],
});

// Database metrics
const dbQueryDuration = new client.Histogram({
  name: 'careforall_db_query_duration_seconds',
  help: 'Duration of database queries in seconds',
  labelNames: ['operation', 'service'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 5],
  registers: [register],
});

const dbConnectionPoolSize = new client.Gauge({
  name: 'careforall_db_connection_pool_size',
  help: 'Current size of database connection pool',
  labelNames: ['service'],
  registers: [register],
});

// BullMQ metrics
const queueJobsProcessed = new client.Counter({
  name: 'careforall_queue_jobs_processed_total',
  help: 'Total number of queue jobs processed',
  labelNames: ['queue', 'status', 'service'],
  registers: [register],
});

const queueJobDuration = new client.Histogram({
  name: 'careforall_queue_job_duration_seconds',
  help: 'Duration of queue job processing in seconds',
  labelNames: ['queue', 'service'],
  buckets: [0.1, 0.5, 1, 5, 10, 30, 60],
  registers: [register],
});

/**
 * Middleware to track HTTP request metrics
 */
function metricsMiddleware(serviceName) {
  return (req, res, next) => {
    const start = Date.now();
    const method = req.method;
    const route = req.route?.path || req.path || 'unknown';

    // Track requests in progress
    httpRequestsInProgress.labels(method, serviceName).inc();

    // Override res.end to capture metrics
    const originalEnd = res.end;
    res.end = function(...args) {
      const duration = (Date.now() - start) / 1000;
      const statusCode = res.statusCode;

      // Record metrics
      httpRequestDuration.labels(method, route, statusCode, serviceName).observe(duration);
      httpRequestTotal.labels(method, route, statusCode, serviceName).inc();
      httpRequestsInProgress.labels(method, serviceName).dec();

      // Track errors (4xx and 5xx)
      if (statusCode >= 400) {
        const errorType = statusCode >= 500 ? 'server_error' : 'client_error';
        errorCounter.labels(errorType, serviceName).inc();
      }

      originalEnd.apply(res, args);
    };

    next();
  };
}

/**
 * Metrics endpoint handler
 */
async function metricsEndpoint(req, res) {
  try {
    res.set('Content-Type', register.contentType);
    const metrics = await register.metrics();
    res.end(metrics);
  } catch (error) {
    res.status(500).end(error);
  }
}

/**
 * Track database query duration
 */
function trackDbQuery(serviceName) {
  return (operation, duration) => {
    dbQueryDuration.labels(operation, serviceName).observe(duration);
  };
}

/**
 * Track database connection pool
 */
function trackDbPool(serviceName) {
  return (poolSize) => {
    dbConnectionPoolSize.labels(serviceName).set(poolSize);
  };
}

/**
 * Track queue job metrics
 */
function trackQueueJob(serviceName) {
  return (queueName, status, duration) => {
    queueJobsProcessed.labels(queueName, status, serviceName).inc();
    if (duration !== undefined) {
      queueJobDuration.labels(queueName, serviceName).observe(duration);
    }
  };
}

/**
 * Track custom error
 */
function trackError(serviceName) {
  return (errorType) => {
    errorCounter.labels(errorType, serviceName).inc();
  };
}

module.exports = {
  metricsMiddleware,
  metricsEndpoint,
  trackDbQuery,
  trackDbPool,
  trackQueueJob,
  trackError,
  register,

  // Expose individual metrics for custom tracking
  metrics: {
    httpRequestDuration,
    httpRequestTotal,
    httpRequestsInProgress,
    errorCounter,
    dbQueryDuration,
    dbConnectionPoolSize,
    queueJobsProcessed,
    queueJobDuration,
  },
};

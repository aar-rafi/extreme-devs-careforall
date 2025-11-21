require('dotenv').config({ path: require('path').resolve(__dirname, '../../../.env') });
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const {
  logger,
  metricsMiddleware,
  metricsEndpoint
} = require('@careforall/shared');
const { getPool } = require('@careforall/shared/database/pool');

// Import routes
const adminRoutes = require('./routes/admin');

const app = express();
const PORT = process.env.PORT || 3006;
const SERVICE_NAME = process.env.SERVICE_NAME || 'admin-service';

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(metricsMiddleware(SERVICE_NAME));

// Request logging middleware
app.use((req, res, next) => {
  const requestId = require('crypto').randomUUID();
  req.requestId = requestId;
  logger.info('Incoming request', {
    requestId,
    method: req.method,
    path: req.path,
    query: req.query,
    ip: req.ip,
  });
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'admin-service',
    timestamp: new Date().toISOString(),
  });
});

// Metrics endpoint for Prometheus
app.get('/metrics', metricsEndpoint);

// Admin API routes
app.use('/api/admin', adminRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error('Unhandled error', {
    requestId: req.requestId,
    error: err.message,
    stack: err.stack,
  });
  res.status(500).json({ error: 'Internal server error' });
});

// Initialize and start the service
async function startServer() {
  try {
    // Initialize database connection pool
    getPool();
    logger.info('Database connection pool initialized');

    // Start Express server
    app.listen(PORT, () => {
      logger.info(`Admin service listening on port ${PORT}`);
    });
  } catch (error) {
    logger.error('Failed to start admin service', { error: error.message });
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');
  process.exit(0);
});

// Start the server
startServer();

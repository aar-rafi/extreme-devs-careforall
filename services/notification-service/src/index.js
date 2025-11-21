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

// Services
const emailService = require('./services/emailService');
const pushService = require('./services/pushService');

// Consumers
const { startPledgeConsumer } = require('./consumers/pledgeConsumer');
const { startCampaignConsumer } = require('./consumers/campaignConsumer');
const { startPaymentConsumer } = require('./consumers/paymentConsumer');

// Routes
const notificationRoutes = require('./routes/notifications');

const app = express();
const PORT = process.env.PORT || 3007;
const SERVICE_NAME = process.env.SERVICE_NAME || 'notification-service';

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(metricsMiddleware(SERVICE_NAME));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'notification-service',
    timestamp: new Date().toISOString(),
  });
});

// Metrics endpoint for Prometheus
app.get('/metrics', metricsEndpoint);

// API routes
app.use('/api/notifications', notificationRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error('Unhandled error', { error: err.message, stack: err.stack });
  res.status(500).json({ error: 'Internal server error' });
});

// Initialize and start the service
async function startServer() {
  try {
    // Initialize database connection pool
    getPool(); // This creates the pool if it doesn't exist
    logger.info('Database connection pool initialized');

    // Initialize email service
    await emailService.initialize();
    logger.info('Email service initialized');

    // Initialize push notification service
    await pushService.initialize();
    logger.info('Push notification service initialized');

    // Start BullMQ consumers
    startPledgeConsumer();
    startCampaignConsumer();
    startPaymentConsumer();
    logger.info('All notification consumers started');

    // Start Express server
    app.listen(PORT, () => {
      logger.info(`Notification service listening on port ${PORT}`);
    });
  } catch (error) {
    logger.error('Failed to start notification service', { error: error.message });
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

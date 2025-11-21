require('dotenv').config({ path: require('path').resolve(__dirname, '../../../.env') });
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const {
  logger,
  errorHandler,
  requestLogger,
  metricsMiddleware,
  metricsEndpoint
} = require('@careforall/shared');

const campaignRoutes = require('./routes/campaignRoutes');
const { startPledgeConsumer } = require('./consumers/pledgeConsumer');

const app = express();
const PORT = process.env.CAMPAIGN_SERVICE_PORT || 3002;
const SERVICE_NAME = process.env.SERVICE_NAME || 'campaign-service';

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(requestLogger);
app.use(metricsMiddleware(SERVICE_NAME));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'campaign-service', timestamp: new Date().toISOString() });
});

// Metrics endpoint for Prometheus
app.get('/metrics', metricsEndpoint);

// Routes
app.use('/api/campaigns', campaignRoutes);

// Error handling
app.use(errorHandler);

// Start server
app.listen(PORT, () => {
  logger.info(`Campaign Service running on port ${PORT}`);
  try {
    startPledgeConsumer();
    logger.info('Campaign Service pledge consumer started');
  } catch (error) {
    logger.error('Failed to start pledge consumer', { error: error.message });
  }
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

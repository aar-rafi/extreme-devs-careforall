require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { logger, errorHandler, requestLogger } = require('@careforall/shared');

const queryRoutes = require('./routes/queryRoutes');
const { startCampaignConsumer } = require('./consumers/campaignConsumer');
const { startPledgeConsumer } = require('./consumers/pledgeConsumer');
const { startPaymentConsumer } = require('./consumers/paymentConsumer');

const app = express();
const PORT = process.env.QUERY_SERVICE_PORT || 3005;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(requestLogger);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'query-service', timestamp: new Date().toISOString() });
});

// Routes
app.use('/api/query', queryRoutes);

// Error handling
app.use(errorHandler);

// Start server
app.listen(PORT, () => {
  logger.info(`Query Service running on port ${PORT}`);

  // Start BullMQ consumers for CQRS read model updates
  startCampaignConsumer();
  startPledgeConsumer();
  startPaymentConsumer();

  logger.info('All event consumers started - CQRS read models active');
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

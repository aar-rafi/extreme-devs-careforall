require('dotenv').config();
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

const pledgeRoutes = require('./routes/pledgeRoutes');
const { startOutboxProcessor } = require('./workers/outboxProcessor');

const app = express();
const PORT = process.env.PLEDGE_SERVICE_PORT || 3003;
const SERVICE_NAME = process.env.SERVICE_NAME || 'pledge-service';

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(requestLogger);
app.use(metricsMiddleware(SERVICE_NAME));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'pledge-service', timestamp: new Date().toISOString() });
});

// Metrics endpoint for Prometheus
app.get('/metrics', metricsEndpoint);

// Routes
app.use('/api/pledges', pledgeRoutes);

// Error handling
app.use(errorHandler);

// Start server
app.listen(PORT, () => {
  logger.info(`Pledge Service running on port ${PORT}`);

  // Start outbox processor
  startOutboxProcessor();
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

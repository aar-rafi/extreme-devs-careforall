require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { logger, errorHandler, requestLogger } = require('@careforall/shared');

const pledgeRoutes = require('./routes/pledgeRoutes');
const { startOutboxProcessor } = require('./workers/outboxProcessor');

const app = express();
const PORT = process.env.PLEDGE_SERVICE_PORT || 3003;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(requestLogger);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'pledge-service', timestamp: new Date().toISOString() });
});

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

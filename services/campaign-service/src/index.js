require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { logger, errorHandler, requestLogger } = require('@careforall/shared');

const campaignRoutes = require('./routes/campaignRoutes');

const app = express();
const PORT = process.env.CAMPAIGN_SERVICE_PORT || 3002;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(requestLogger);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'campaign-service', timestamp: new Date().toISOString() });
});

// Routes
app.use('/api/campaigns', campaignRoutes);

// Error handling
app.use(errorHandler);

// Start server
app.listen(PORT, () => {
  logger.info(`Campaign Service running on port ${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

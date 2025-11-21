/**
 * Chatbot Service - Main Entry Point
 * AI Chatbot with Bangla language support for CareForAll platform
 */

require('dotenv').config();
const express = require('express');
const { errorHandler, requestLogger, logger } = require('@careforall/shared');
const { initializeDatabase } = require('./utils/initDb');
const { startCampaignConsumer } = require('./consumers/campaignConsumer');
const chatRoutes = require('./routes/chatRoutes');

const app = express();
const PORT = process.env.PORT || 3008;
const SERVICE_NAME = 'chatbot-service';

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(requestLogger);

// CORS middleware
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }

  next();
});

// Routes
app.use('/api/chat', chatRoutes);

// Root health check
app.get('/health', (req, res) => {
  res.json({
    success: true,
    service: SERVICE_NAME,
    status: 'healthy',
    timestamp: new Date().toISOString(),
    features: {
      banglaSupport: true,
      conversationManagement: true,
      knowledgeBase: true,
      eventConsumers: true
    }
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
    path: req.path
  });
});

// Error handler
app.use(errorHandler);

/**
 * Initialize service
 */
async function startService() {
  try {
    logger.info(`Starting ${SERVICE_NAME}...`);

    // Initialize database schema
    logger.info('Initializing database schema...');
    await initializeDatabase();

    // Start event consumers
    logger.info('Starting event consumers...');
    await startCampaignConsumer();

    // Start HTTP server
    app.listen(PORT, () => {
      logger.info(`✅ ${SERVICE_NAME} is running on port ${PORT}`);
      logger.info(`📡 Health check: http://localhost:${PORT}/health`);
      logger.info(`💬 Chat API: http://localhost:${PORT}/api/chat`);
      logger.info(`🇧🇩 Bangla language support: Enabled`);
    });
  } catch (error) {
    logger.error(`❌ Failed to start ${SERVICE_NAME}:`, error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully...');
  process.exit(0);
});

// Start the service
startService();

module.exports = app;

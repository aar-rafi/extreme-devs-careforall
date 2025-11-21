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

const authRoutes = require('./routes/authRoutes');

const app = express();
const PORT = process.env.AUTH_SERVICE_PORT || 3001;
const SERVICE_NAME = process.env.SERVICE_NAME || 'auth-service';

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(requestLogger);
app.use(metricsMiddleware(SERVICE_NAME));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'auth-service', timestamp: new Date().toISOString() });
});

// Metrics endpoint for Prometheus
app.get('/metrics', metricsEndpoint);

// Routes
app.use('/api/auth', authRoutes);

// Error handling
app.use(errorHandler);

// Start server
app.listen(PORT, () => {
  logger.info(`Auth Service running on port ${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

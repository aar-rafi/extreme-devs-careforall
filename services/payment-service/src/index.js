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
const paymentRoutes = require('./routes/paymentRoutes');

const app = express();
const PORT = process.env.PAYMENT_SERVICE_PORT || 3004;
const SERVICE_NAME = process.env.SERVICE_NAME || 'payment-service';

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(requestLogger);
app.use(metricsMiddleware(SERVICE_NAME));

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'payment-service', timestamp: new Date().toISOString() });
});

app.get('/metrics', metricsEndpoint);

app.use('/api/payments', paymentRoutes);
app.use(errorHandler);

app.listen(PORT, () => {
  logger.info(`Payment Service running on port ${PORT}`);
});

process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

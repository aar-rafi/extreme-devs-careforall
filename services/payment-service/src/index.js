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
const paymentRoutes = require('./routes/paymentRoutes');
const { startPaymentConsumer } = require('./consumers/paymentConsumer');

const app = express();
const PORT = process.env.PAYMENT_SERVICE_PORT || 3004;
const SERVICE_NAME = process.env.SERVICE_NAME || 'payment-service';

app.use(helmet());
app.use(cors());
// Parse URL-encoded bodies (SSLCommerz IPN typically sends application/x-www-form-urlencoded)
app.use(express.urlencoded({ extended: true }));
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

  // Start payment event consumer
  try {
    startPaymentConsumer();
    logger.info('Payment event consumer started successfully');
  } catch (error) {
    logger.error('Failed to start payment consumer', { error: error.message });
  }
});

process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

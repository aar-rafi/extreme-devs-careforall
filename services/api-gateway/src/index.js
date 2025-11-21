require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { createProxyMiddleware } = require('http-proxy-middleware');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
});
app.use(limiter);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'api-gateway', timestamp: new Date().toISOString() });
});

// Route proxying
const routes = {
  '/api/auth': process.env.AUTH_SERVICE_URL || 'http://auth-service:3001',
  '/api/campaigns': process.env.CAMPAIGN_SERVICE_URL || 'http://campaign-service:3002',
  '/api/pledges': process.env.PLEDGE_SERVICE_URL || 'http://pledge-service:3003',
  '/api/payments': process.env.PAYMENT_SERVICE_URL || 'http://payment-service:3004',
  '/api/query': process.env.QUERY_SERVICE_URL || 'http://query-service:3005',
  '/api/admin': process.env.ADMIN_SERVICE_URL || 'http://admin-service:3006',
  '/api/notifications': process.env.NOTIFICATION_SERVICE_URL || 'http://notification-service:3007',
};

// Setup proxies - each service handles its own /api/* paths
Object.entries(routes).forEach(([path, target]) => {
  app.use(
    path,
    createProxyMiddleware({
      target,
      changeOrigin: true,
      // Don't rewrite the path - let services handle full paths
      logLevel: 'debug',
    })
  );
});

app.listen(PORT, () => {
  console.log(`API Gateway running on port ${PORT}`);
});

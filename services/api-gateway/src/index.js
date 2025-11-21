require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { createProxyMiddleware } = require('http-proxy-middleware');
const rateLimit = require('express-rate-limit');
const client = require('prom-client');

const app = express();
const PORT = process.env.PORT || 3000;

// Prometheus metrics setup
const register = new client.Registry();
client.collectDefaultMetrics({ register, prefix: 'careforall_gateway_' });

const httpRequestDuration = new client.Histogram({
  name: 'careforall_gateway_http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 5],
  registers: [register],
});

// Middleware
app.use(helmet());
app.use(cors());
// Note: express.json() removed - API Gateway is a pure proxy
// Backend services handle their own body parsing

// Metrics middleware for API Gateway
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    httpRequestDuration.labels(req.method, req.path, res.statusCode).observe(duration);
  });
  next();
});

// Metrics middleware for API Gateway
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    httpRequestDuration.labels(req.method, req.path, res.statusCode).observe(duration);
  });
  next();
});


const limiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute window
  max: 1000, // 1000 requests per minute (very generous for development)
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'api-gateway', timestamp: new Date().toISOString() });
});

// Metrics endpoint for Prometheus
app.get('/metrics', async (req, res) => {
  try {
    res.set('Content-Type', register.contentType);
    const metrics = await register.metrics();
    res.end(metrics);
  } catch (error) {
    res.status(500).end(error);
  }
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

# CareForAll Platform

> Next-generation fundraising platform with microservices architecture built for the API Avengers - Microservice Hackathon 2025

## 🎯 Overview

CareForAll is a highly scalable, fault-tolerant fundraising platform designed to handle high-traffic charity campaigns while maintaining data consistency and complete transparency. Built with modern microservices architecture, event-driven patterns, and comprehensive observability.

### Key Features

- ✅ **Fault-Tolerant** - Transactional Outbox pattern, idempotency, state machines
- ✅ **Scalable** - Horizontal scaling, caching, CQRS pattern
- ✅ **Observable** - Full monitoring, logging, and distributed tracing
- ✅ **Secure** - JWT authentication, input validation, rate limiting
- ✅ **Reliable** - Event-driven architecture with retry mechanisms

### Problems Solved

- ❌ Double Charging → ✅ Idempotency keys and webhook deduplication
- ❌ Lost Donations → ✅ Transactional Outbox pattern
- ❌ Out-of-Order Webhooks → ✅ State machines with validation
- ❌ Slow Totals Calculation → ✅ CQRS with pre-calculated read models
- ❌ Zero Observability → ✅ Built-in monitoring, logging, and tracing

## 🏗️ Architecture

### Microservices

1. **API Gateway** (Port 3000) - Single entry point, routing, rate limiting, JWT validation
2. **Auth Service** (Port 3001) - User authentication and authorization
3. **Campaign Service** (Port 3002) - Campaign CRUD and management
4. **Pledge Service** (Port 3003) - Donation pledges with Transactional Outbox
5. **Payment Service** (Port 3004) - SSLCommerz integration, idempotency, webhooks
6. **Query Service** (Port 3005) - CQRS read models, optimized queries
7. **Admin Service** (Port 3006) - Admin dashboard, audit logs
8. **Notification Service** (Port 3007) - Email/SMS notifications

### Infrastructure

- **PostgreSQL 16** - Single instance with separate schemas per service
- **Redis 7+** - Caching + BullMQ message queue
- **BullMQ** - Event bus for asynchronous communication
- **Prometheus + Grafana** - Metrics and dashboards
- **ELK Stack** - Centralized logging
- **Jaeger** - Distributed tracing

## 🚀 Quick Start

### Prerequisites

- Docker & Docker Compose
- Node.js 20+ (for local development)
- PostgreSQL 16+ (optional, for local dev)
- Redis 7+ (optional, for local dev)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/api-avengers/careforall.git
   cd careforall
   ```

2. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. **Start all services with Docker Compose**
   ```bash
   docker-compose up -d
   ```

4. **View logs**
   ```bash
   docker-compose logs -f
   ```

5. **Access the services**
   - API Gateway: http://localhost:3000
   - Bull Board (Queue Monitor): http://localhost:3100
   - Grafana: http://localhost:3001 (admin/admin)
   - Prometheus: http://localhost:9090
   - Kibana: http://localhost:5601
   - Jaeger UI: http://localhost:16686

### Database Initialization

The database is automatically initialized with all schemas when you first start PostgreSQL. The initialization script is located at `database/init-db.sql`.

## 📚 API Documentation

### Authentication

All protected endpoints require a JWT token in the Authorization header:

```http
Authorization: Bearer <your-jwt-token>
```

### Core Endpoints

#### Auth Service

```http
POST   /api/auth/register       # Register new user
POST   /api/auth/login          # Login user
POST   /api/auth/refresh        # Refresh access token
POST   /api/auth/logout         # Logout user
GET    /api/auth/profile        # Get user profile
PUT    /api/auth/profile        # Update user profile
```

#### Campaign Service

```http
POST   /api/campaigns           # Create campaign (AUTH)
GET    /api/campaigns           # List campaigns (PUBLIC)
GET    /api/campaigns/:id       # Get campaign details (PUBLIC)
PUT    /api/campaigns/:id       # Update campaign (AUTH)
DELETE /api/campaigns/:id       # Delete campaign (ADMIN)
```

#### Pledge Service

```http
POST   /api/pledges             # Create pledge (OPTIONAL AUTH)
GET    /api/pledges/:id         # Get pledge details
GET    /api/pledges/user/:userId  # Get user's pledges (AUTH)
```

#### Payment Service

```http
POST   /api/payments/initiate   # Initiate payment
POST   /api/payments/webhook/ipn  # SSLCommerz webhook (PUBLIC)
GET    /api/payments/:id        # Get payment details (AUTH)
```

#### Query Service (Optimized Reads)

```http
GET    /api/query/campaigns/:id/totals     # Get campaign totals (FAST)
GET    /api/query/campaigns/:id/donations  # Get donation history
GET    /api/query/users/:id/donations      # Get user donations
GET    /api/query/statistics/platform      # Platform statistics
```

## 🔧 Development

### Local Development Setup

1. **Install dependencies for all services**
   ```bash
   npm install
   ```

2. **Start individual service for development**
   ```bash
   cd services/auth-service
   npm install
   npm run dev
   ```

### Running Tests

```bash
# Run all tests
npm test

# Run tests for specific service
cd services/auth-service
npm test
```

### Linting

```bash
# Lint all services
npm run lint

# Lint specific service
cd services/auth-service
npm run lint
```

## 🎨 Technology Stack

### Backend
- **Runtime:** Node.js 20+
- **Framework:** Express.js
- **Database:** PostgreSQL 16
- **Cache:** Redis 7+
- **Message Queue:** BullMQ

### Authentication
- **JWT** - Access tokens (15min)
- **Refresh Tokens** - Long-lived tokens (7 days)
- **bcrypt** - Password hashing

### Payment Gateway
- **SSLCommerz** - Bangladesh's largest payment aggregator
- Supports: bKash, Nagad, Rocket, Cards

### DevOps
- **Docker** - Containerization
- **Docker Compose** - Orchestration
- **GitHub Actions** - CI/CD

### Monitoring
- **Prometheus** - Metrics collection
- **Grafana** - Visualization
- **ELK Stack** - Centralized logging
- **Jaeger** - Distributed tracing
- **Bull Board** - Queue monitoring

## 🏛️ Architecture Patterns

### 1. CQRS (Command Query Responsibility Segregation)
- Separate read and write models
- Optimized queries with pre-calculated aggregates
- Scalable reads independently

### 2. Transactional Outbox Pattern
- Ensures reliable event publishing
- No lost events even if message queue is down
- At-least-once delivery guarantee

### 3. Idempotency Pattern
- Prevents duplicate operations
- Safe retries for failed requests
- Webhook deduplication

### 4. State Machine Pattern
- Payment state transitions validation
- Prevents out-of-order webhooks
- Complete audit trail

### 5. Event-Driven Architecture
- Asynchronous communication via BullMQ
- Loose coupling between services
- Scalable event processing

## 📊 Database Schemas

The platform uses a single PostgreSQL instance with separate schemas:

- `auth` - User authentication and profiles
- `campaigns` - Campaign management
- `pledges` - Donation pledges and outbox
- `payments` - Payment processing and idempotency
- `query` - CQRS read models
- `admin` - Admin operations and audit logs

## 🔒 Security

- **JWT Authentication** - Secure token-based auth
- **bcrypt Password Hashing** - 10 rounds
- **Input Validation** - Joi schemas
- **Rate Limiting** - Per-route limits
- **CORS** - Configured origins
- **Helmet** - Security headers
- **SQL Injection Prevention** - Parameterized queries

## 📈 Scalability

### Horizontal Scaling

```bash
# Scale specific service
docker-compose up --scale campaign-service=3 --scale query-service=5
```

### Caching Strategy

- API Gateway cache (30-60s TTL)
- Query Service cache for hot campaigns
- Redis session cache

### Performance Targets

| Operation | Target Latency | Target Throughput |
|-----------|---------------|-------------------|
| GET Campaign | < 100ms | 500 req/s |
| GET Totals | < 50ms | 1000 req/s |
| Create Pledge | < 500ms | 200 req/s |
| Process Payment | < 2s | 100 req/s |

## 🧪 Testing Strategy

### Unit Tests
- Test individual functions
- Mock external dependencies
- Target: 80%+ coverage

### Integration Tests
- Test service interactions
- Test database operations
- Test event publishing/consuming

### E2E Tests
- Complete user journeys
- Real database (test environment)
- Observability stack integration

## 📝 Environment Variables

See `.env.example` for all required environment variables. Key variables:

```env
# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/careforall

# Redis
REDIS_URL=redis://localhost:6379

# JWT
JWT_SECRET=your-super-secret-jwt-key
JWT_EXPIRES_IN=15m
REFRESH_TOKEN_EXPIRES_IN=7d

# SSLCommerz
SSLCOMMERZ_STORE_ID=your-store-id
SSLCOMMERZ_STORE_PASSWORD=your-store-password

# SMTP
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
```

## 🚦 CI/CD

GitHub Actions workflows are configured for:

- Automated testing on PR
- Code linting and formatting
- Docker image building
- Deployment to production

## 📖 Documentation

- [Architecture Design](./CareForAll-Architecture-Design.md) - Complete architecture documentation
- API Documentation - Swagger/OpenAPI (coming soon)
- Database Schema - See `database/init-db.sql`

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📜 License

This project is licensed under the MIT License.

## 👥 Team

**API Avengers**

- Team Lead: [Name]
- Backend Developer: [Name]
- DevOps Engineer: [Name]
- Database Architect: [Name]

## 🙏 Acknowledgments

- CUET - IT Business Incubator
- Microservice Hackathon 2025
- SSLCommerz for payment integration support

## 📞 Support

For issues and questions:
- Create an issue on GitHub
- Email: team@apiavengers.dev
- Discord: [Link]

---

**Built with ❤️ by API Avengers for Microservice Hackathon 2025**

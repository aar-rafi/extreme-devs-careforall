# CareForAll Platform - Architecture & Design Document
## API Avengers - Microservice Hackathon 2025

**Team:** API Avengers  
**Date:** November 21, 2025  
**Location:** CUET - IT Business Incubator

---

## Table of Contents
1. [Executive Summary](#executive-summary)
2. [System Requirements](#system-requirements)
3. [Technology Stack](#technology-stack)
4. [System Architecture](#system-architecture)
5. [Service Details](#service-details)
6. [Data Models](#data-models)
7. [Event-Driven Architecture](#event-driven-architecture)
8. [API Design](#api-design)
9. [Key Architectural Patterns](#key-architectural-patterns)
10. [Scalability Strategy](#scalability-strategy)
11. [Security Considerations](#security-considerations)

---

## Executive Summary

CareForAll is a next-generation fundraising platform designed to handle high-traffic charity campaigns while maintaining data consistency, fault tolerance, and complete transparency. This document outlines the microservices architecture that addresses critical failures of the legacy system:

### Problems Solved
- ✅ **Double Charging** - Idempotency keys and webhook deduplication
- ✅ **Lost Donations** - Transactional Outbox pattern for reliable event publishing
- ✅ **Out-of-Order Webhooks** - State machines with proper validation
- ✅ **Slow Totals Calculation** - CQRS with pre-calculated read models
- ✅ **Zero Observability** - Built-in monitoring, logging, and tracing

### Key Features
- Support for registered and anonymous donors
- Multiple campaign types (Medical, Education, Emergency, Long-term)
- Real-time donation tracking with optimized queries
- Secure payment processing via SSLCommerz (bKash, Nagad, Cards)
- Complete audit trail and admin dashboard
- Horizontal scalability to handle 1000+ requests/second

---

## System Requirements

### Functional Requirements
1. User authentication and authorization (JWT-based)
2. Campaign creation and management
3. Anonymous and registered user donations
4. Multiple payment methods (bKash, Nagad, Cards via SSLCommerz)
5. Real-time campaign totals
6. Email notifications for key events
7. Admin dashboard for monitoring and management
8. Complete donation history for all users

### Non-Functional Requirements
1. **Scalability:** Handle 1000+ requests/second
2. **Availability:** 99.9% uptime target
3. **Consistency:** Strong consistency for payments, eventual for read models
4. **Latency:** < 200ms for read operations, < 2s for write operations
5. **Reliability:** Zero data loss for payment transactions
6. **Observability:** End-to-end tracing, centralized logging, real-time metrics

---

## Technology Stack

### Backend Services
- **Language:** Node.js (v20+)
- **Framework:** Express.js
- **Runtime:** Node.js with PM2 for production

### Data Layer
- **Primary Database:** PostgreSQL 16 (single instance, separate schemas per service)
- **Cache:** Redis 7+ (caching + BullMQ)
- **Message Queue:** BullMQ (Redis-based)

### Authentication
- **Custom JWT-based authentication**
- Libraries: `jsonwebtoken`, `bcrypt`
- Token storage: Redis for blacklisting

### Payment Gateway
- **SSLCommerz** - Bangladesh's largest payment aggregator
- Supports: bKash, Nagad, Rocket, Upay, Cards (Visa/Mastercard/Amex)
- Integration: REST API + IPN (Instant Payment Notification) webhooks

### Infrastructure
- **Containerization:** Docker + Docker Compose
- **API Gateway:** Express Gateway / Custom Node.js Gateway
- **Load Balancing:** Nginx (included in API Gateway)
- **Monitoring:** Prometheus + Grafana + NodeExporter + cAdvisor
- **Logging:** ELK Stack (Elasticsearch, Logstash, Kibana)
- **Tracing:** OpenTelemetry + Jaeger

### DevOps
- **CI/CD:** GitHub Actions
- **Version Control:** Git + GitHub
- **Semantic Versioning:** Major.Minor.Patch (e.g., v1.0.0)

---

## System Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         Frontend                             │
│              (React/Next.js - Minimal UI)                    │
└────────────────────┬────────────────────────────────────────┘
                     │
                     │ HTTPS
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                      API Gateway                             │
│         (Load Balancing, Rate Limiting, Routing)            │
└─────┬──────┬──────┬──────┬──────┬──────┬──────┬────────────┘
      │      │      │      │      │      │      │
      │      │      │      │      │      │      │
      ▼      ▼      ▼      ▼      ▼      ▼      ▼
┌─────────┐ ┌──────────┐ ┌────────┐ ┌─────────┐ ┌──────────┐
│  Auth   │ │ Campaign │ │ Pledge │ │ Payment │ │  Query   │
│ Service │ │ Service  │ │Service │ │ Service │ │ Service  │
└────┬────┘ └─────┬────┘ └───┬────┘ └────┬────┘ └─────┬────┘
     │            │           │           │            │
     │            │           │           │            │
     ▼            ▼           ▼           ▼            ▼
┌─────────────────────────────────────────────────────────────┐
│                  PostgreSQL Database                         │
│    (Separate Schemas: auth, campaigns, pledges,             │
│     payments, query, admin)                                  │
└─────────────────────────────────────────────────────────────┘

                            ▲
                            │
                            │ Events
                            │
┌─────────────────────────────────────────────────────────────┐
│                      BullMQ + Redis                          │
│         (Event Bus, Job Queue, Cache, Sessions)             │
└────────────┬────────────┬────────────┬─────────────────────┘
             │            │            │
             ▼            ▼            ▼
      ┌──────────┐  ┌─────────┐  ┌──────────┐
      │  Query   │  │  Notif  │  │  Admin   │
      │ Service  │  │ Service │  │ Service  │
      │(Consumer)│  │         │  │          │
      └──────────┘  └─────────┘  └──────────┘

┌─────────────────────────────────────────────────────────────┐
│                  Observability Stack                         │
│  Prometheus + Grafana + ELK + Jaeger + Bull Board          │
└─────────────────────────────────────────────────────────────┘
```

### Service Communication Patterns

**Synchronous (REST API):**
- Frontend ↔ API Gateway ↔ Services
- Service-to-Service (when immediate response needed)

**Asynchronous (BullMQ):**
- Event publishing for state changes
- Background job processing
- Cross-service notifications

---

## Service Details

### 1. API Gateway
**Port:** 3000  
**Responsibilities:**
- Single entry point for all client requests
- Route requests to appropriate microservices
- Rate limiting and request throttling
- JWT validation (calls Auth Service)
- Load balancing across service replicas
- Request/Response logging
- CORS handling

**Tech Stack:**
- Express.js
- express-rate-limit
- http-proxy-middleware
- helmet (security headers)

**Routing Table:**
```
/api/auth/*          → Auth Service (3001)
/api/campaigns/*     → Campaign Service (3002)
/api/pledges/*       → Pledge Service (3003)
/api/payments/*      → Payment Service (3004)
/api/query/*         → Query Service (3005)
/api/admin/*         → Admin Service (3006)
/api/notifications/* → Notification Service (3007)
```

---

### 2. Auth Service
**Port:** 3001  
**Database Schema:** `auth`  
**Responsibilities:**
- User registration and login
- JWT token generation and validation
- Password hashing with bcrypt
- Role-based access control (USER, ADMIN)
- Token refresh mechanism
- User profile management

**Key Endpoints:**
```
POST   /api/auth/register
POST   /api/auth/login
POST   /api/auth/refresh
POST   /api/auth/logout
GET    /api/auth/profile
PUT    /api/auth/profile
GET    /api/auth/verify (internal - for API Gateway)
```

**Auth Flow:**
1. User registers → Password hashed → User created
2. User logs in → Credentials verified → JWT issued (15min access, 7d refresh)
3. Protected requests → Gateway validates JWT → Forwards with user context
4. Token refresh → New access token issued

---

### 3. Campaign Service
**Port:** 3002  
**Database Schema:** `campaigns`  
**Responsibilities:**
- Campaign CRUD operations
- Campaign validation and approval workflow
- Campaign status management
- Support multiple campaign types
- Campaign search and filtering

**Campaign Types:**
- `medical` - Healthcare/treatment campaigns
- `education` - Educational support
- `emergency` - Disaster relief, urgent needs
- `long_term` - Ongoing support programs

**Campaign Status:**
- `draft` - Created but not published
- `active` - Accepting donations
- `completed` - Goal reached or time expired
- `cancelled` - Cancelled by admin/organizer
- `expired` - End date passed

**Key Endpoints:**
```
POST   /api/campaigns              (Auth: USER)
GET    /api/campaigns              (Public)
GET    /api/campaigns/:id          (Public)
PUT    /api/campaigns/:id          (Auth: OWNER/ADMIN)
DELETE /api/campaigns/:id          (Auth: ADMIN)
PATCH  /api/campaigns/:id/status   (Auth: ADMIN)
GET    /api/campaigns/user/:userId (Auth: USER)
```

**Events Published:**
- `campaign.created`
- `campaign.updated`
- `campaign.goal_reached`
- `campaign.expired`

---

### 4. Pledge Service
**Port:** 3003  
**Database Schema:** `pledges`  
**Responsibilities:**
- Create donation pledges (registered + anonymous users)
- Manage pledge lifecycle
- Implement Transactional Outbox pattern
- Ensure pledge-payment association
- Anonymous donor support (email-only)

**Pledge Status:**
- `pending` - Pledge created, payment not initiated
- `payment_initiated` - Payment in progress
- `completed` - Payment successful
- `failed` - Payment failed
- `refunded` - Payment refunded

**Key Endpoints:**
```
POST   /api/pledges                     (Auth: Optional)
GET    /api/pledges/:id                 (Auth: Optional)
GET    /api/pledges/user/:userId        (Auth: USER)
GET    /api/pledges/campaign/:campaignId (Public)
```

**Outbox Pattern Implementation:**
```sql
-- Every pledge creation is a transaction:
BEGIN;
  INSERT INTO pledges.pledges (...);
  INSERT INTO pledges.outbox (event_type='pledge.created', ...);
COMMIT;

-- Background worker processes outbox:
- Read unprocessed events
- Publish to BullMQ
- Mark as processed
- Retry on failure
```

**Events Published:**
- `pledge.created`
- `pledge.completed`
- `pledge.failed`
- `pledge.refunded`

---

### 5. Payment Service
**Port:** 3004  
**Database Schema:** `payments`  
**Responsibilities:**
- SSLCommerz payment integration
- Handle payment webhooks (IPN)
- Implement idempotency for all payment operations
- Payment state machine management
- Webhook deduplication
- Payment retry logic

**Payment State Machine:**
```
pending → authorized → captured → completed
   ↓         ↓           ↓
  failed   failed     failed
   ↓         ↓           ↓
 (end)    (retry)     refunded
```

**State Transitions:**
- `pending` → `authorized`: SSLCommerz authorizes payment
- `authorized` → `captured`: Funds captured from customer
- `captured` → `completed`: Payment settlement confirmed
- Any state → `failed`: Payment failure
- `completed` → `refunded`: Admin-initiated refund

**Key Endpoints:**
```
POST   /api/payments/initiate         (Auth: Optional)
POST   /api/payments/webhook/ipn      (Public - SSLCommerz)
GET    /api/payments/:id              (Auth: USER/ADMIN)
POST   /api/payments/:id/refund       (Auth: ADMIN)
GET    /api/payments/pledge/:pledgeId (Auth: USER/ADMIN)
```

**Idempotency Implementation:**
```javascript
// Every payment request includes idempotency key
headers: {
  'X-Idempotency-Key': 'uuid-v4'
}

// Server checks if request already processed
if (await existsIdempotencyKey(key)) {
  return cachedResponse; // Return same response
}

// Process request + store response atomically
```

**Webhook Deduplication:**
```javascript
// Each webhook has unique ID
const webhookId = req.body.webhook_id;

// Check if already processed
if (await isWebhookProcessed(webhookId)) {
  return res.status(200).send('OK'); // ACK but don't process
}

// Process + mark as processed atomically
```

**Events Published:**
- `payment.authorized`
- `payment.captured`
- `payment.completed`
- `payment.failed`
- `payment.refunded`

---

### 6. Query Service (CQRS Read Model)
**Port:** 3005  
**Database Schema:** `query`  
**Responsibilities:**
- Maintain denormalized read models
- Pre-calculate campaign totals
- Provide optimized read-only endpoints
- Listen to events and update projections
- Handle high-volume read traffic

**Read Models:**
1. **Campaign Totals** - Pre-calculated sums, donor counts
2. **Donation History** - Chronological donation records
3. **User Statistics** - User donation summaries

**Key Endpoints:**
```
GET    /api/query/campaigns/:id/totals
GET    /api/query/campaigns/:id/donations
GET    /api/query/campaigns/top            (Top campaigns)
GET    /api/query/users/:id/donations
GET    /api/query/statistics/platform
```

**Event Handlers (BullMQ Consumers):**
- `pledge.completed` → Update campaign totals, add to donation history
- `payment.completed` → Increment donor count
- `payment.refunded` → Decrement totals
- `campaign.created` → Add to totals table

**Performance Optimization:**
- Redis caching for hot campaigns
- Database indexes on frequently queried fields
- Materialized views for complex aggregations

---

### 7. Notification Service
**Port:** 3007  
**Responsibilities:**
- Send email notifications
- SMS notifications (future)
- Push notifications (future)
- Template management
- Notification history

**Email Events:**
- User registered → Welcome email
- Pledge created → Confirmation email (donor)
- Payment completed → Receipt email (donor)
- Payment completed → Notification email (campaign owner)
- Campaign goal reached → Celebration email
- Campaign expired → Final report email

**Key Endpoints:**
```
POST   /api/notifications/email (Internal only)
GET    /api/notifications/user/:userId (Auth: USER)
```

**Tech Stack:**
- Nodemailer
- Email templates (Handlebars)
- BullMQ for async processing

**Event Handlers:**
- `pledge.completed` → Send confirmation email
- `payment.completed` → Send receipt email
- `campaign.goal_reached` → Send celebration email

---

### 8. Admin Service
**Port:** 3006  
**Database Schema:** `admin`  
**Responsibilities:**
- Admin dashboard backend
- Campaign approval workflow
- User management
- Payment refund processing
- Audit logging
- System health metrics

**Key Endpoints:**
```
GET    /api/admin/dashboard/stats      (Auth: ADMIN)
GET    /api/admin/campaigns            (Auth: ADMIN)
PATCH  /api/admin/campaigns/:id/approve (Auth: ADMIN)
GET    /api/admin/users                (Auth: ADMIN)
PATCH  /api/admin/users/:id/status     (Auth: ADMIN)
GET    /api/admin/payments             (Auth: ADMIN)
POST   /api/admin/payments/:id/refund  (Auth: ADMIN)
GET    /api/admin/audit-logs           (Auth: ADMIN)
```

**Audit Logging:**
All admin actions are logged:
```javascript
{
  admin_id: 'uuid',
  action: 'approve_campaign',
  entity_type: 'campaign',
  entity_id: 'campaign_uuid',
  details: { previous_status: 'draft', new_status: 'active' },
  created_at: 'timestamp'
}
```

---

## Data Models

### Database Strategy
- **Single PostgreSQL instance**
- **Separate schemas per service** for logical isolation
- **Shared connection pool** for efficiency
- **Migration strategy:** Separate migration files per schema

### Schema: auth

```sql
-- users table
CREATE TABLE auth.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(20) DEFAULT 'USER' CHECK (role IN ('USER', 'ADMIN')),
  is_active BOOLEAN DEFAULT true,
  email_verified BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- user_profiles table
CREATE TABLE auth.user_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  phone VARCHAR(20),
  avatar_url TEXT,
  bio TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id)
);

-- refresh_tokens table
CREATE TABLE auth.refresh_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  token VARCHAR(500) UNIQUE NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_users_email ON auth.users(email);
CREATE INDEX idx_users_role ON auth.users(role);
CREATE INDEX idx_refresh_tokens_user ON auth.refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_expires ON auth.refresh_tokens(expires_at);
```

---

### Schema: campaigns

```sql
-- campaigns table
CREATE TABLE campaigns.campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  campaign_type VARCHAR(50) NOT NULL CHECK (
    campaign_type IN ('medical', 'education', 'emergency', 'long_term')
  ),
  goal_amount DECIMAL(15, 2) NOT NULL CHECK (goal_amount > 0),
  current_amount DECIMAL(15, 2) DEFAULT 0 CHECK (current_amount >= 0),
  start_date TIMESTAMP DEFAULT NOW(),
  end_date TIMESTAMP,
  status VARCHAR(20) DEFAULT 'draft' CHECK (
    status IN ('draft', 'active', 'completed', 'cancelled', 'expired')
  ),
  organizer_id UUID NOT NULL, -- references auth.users.id
  beneficiary_name VARCHAR(255),
  beneficiary_details TEXT,
  image_url TEXT,
  documents JSONB, -- Supporting documents URLs
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT valid_dates CHECK (end_date IS NULL OR end_date > start_date)
);

-- Indexes
CREATE INDEX idx_campaigns_status ON campaigns.campaigns(status);
CREATE INDEX idx_campaigns_organizer ON campaigns.campaigns(organizer_id);
CREATE INDEX idx_campaigns_type ON campaigns.campaigns(campaign_type);
CREATE INDEX idx_campaigns_dates ON campaigns.campaigns(start_date, end_date);
CREATE INDEX idx_campaigns_created ON campaigns.campaigns(created_at DESC);

-- Full-text search index
CREATE INDEX idx_campaigns_search ON campaigns.campaigns 
  USING gin(to_tsvector('english', title || ' ' || description));
```

---

### Schema: pledges

```sql
-- pledges table
CREATE TABLE pledges.pledges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL, -- references campaigns.campaigns.id
  user_id UUID, -- nullable for anonymous donations, references auth.users.id
  donor_email VARCHAR(255) NOT NULL,
  donor_name VARCHAR(255),
  amount DECIMAL(15, 2) NOT NULL CHECK (amount > 0),
  currency VARCHAR(3) DEFAULT 'BDT',
  status VARCHAR(20) DEFAULT 'pending' CHECK (
    status IN ('pending', 'payment_initiated', 'completed', 'failed', 'refunded')
  ),
  is_anonymous BOOLEAN DEFAULT false,
  message TEXT,
  metadata JSONB, -- Additional donor info
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Outbox pattern for reliable event publishing
CREATE TABLE pledges.outbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  aggregate_id UUID NOT NULL, -- pledge_id
  event_type VARCHAR(100) NOT NULL,
  payload JSONB NOT NULL,
  processed BOOLEAN DEFAULT false,
  retry_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  processed_at TIMESTAMP
);

-- Indexes
CREATE INDEX idx_pledges_campaign ON pledges.pledges(campaign_id);
CREATE INDEX idx_pledges_user ON pledges.pledges(user_id);
CREATE INDEX idx_pledges_status ON pledges.pledges(status);
CREATE INDEX idx_pledges_email ON pledges.pledges(donor_email);
CREATE INDEX idx_pledges_created ON pledges.pledges(created_at DESC);

CREATE INDEX idx_outbox_processed ON pledges.outbox(processed, created_at);
CREATE INDEX idx_outbox_retry ON pledges.outbox(retry_count);
```

---

### Schema: payments

```sql
-- payments table
CREATE TABLE payments.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pledge_id UUID NOT NULL UNIQUE, -- references pledges.pledges.id
  transaction_id VARCHAR(255), -- SSLCommerz transaction ID
  payment_method VARCHAR(50), -- bkash, nagad, rocket, card, etc.
  amount DECIMAL(15, 2) NOT NULL CHECK (amount > 0),
  currency VARCHAR(3) DEFAULT 'BDT',
  status VARCHAR(20) DEFAULT 'pending' CHECK (
    status IN ('pending', 'authorized', 'captured', 'completed', 'failed', 'refunded')
  ),
  gateway_response JSONB, -- Full SSLCommerz response
  error_message TEXT,
  refund_reason TEXT,
  refunded_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Idempotency key storage
CREATE TABLE payments.idempotency_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  idempotency_key VARCHAR(255) UNIQUE NOT NULL,
  request_hash VARCHAR(255) NOT NULL, -- Hash of request body
  response JSONB,
  status_code INTEGER,
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP NOT NULL
);

-- Webhook tracking to prevent duplicate processing
CREATE TABLE payments.webhook_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id VARCHAR(255) UNIQUE NOT NULL, -- SSLCommerz webhook ID
  event_type VARCHAR(100) NOT NULL,
  payload JSONB NOT NULL,
  processed BOOLEAN DEFAULT false,
  error_message TEXT,
  processed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Payment state history for audit trail
CREATE TABLE payments.payment_state_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID NOT NULL REFERENCES payments.payments(id),
  from_status VARCHAR(20),
  to_status VARCHAR(20) NOT NULL,
  reason TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_payments_pledge ON payments.payments(pledge_id);
CREATE INDEX idx_payments_transaction ON payments.payments(transaction_id);
CREATE INDEX idx_payments_status ON payments.payments(status);
CREATE INDEX idx_payments_created ON payments.payments(created_at DESC);

CREATE INDEX idx_idempotency_key ON payments.idempotency_keys(idempotency_key);
CREATE INDEX idx_idempotency_expires ON payments.idempotency_keys(expires_at);

CREATE INDEX idx_webhook_id ON payments.webhook_logs(webhook_id);
CREATE INDEX idx_webhook_processed ON payments.webhook_logs(processed, created_at);

CREATE INDEX idx_payment_history ON payments.payment_state_history(payment_id, created_at DESC);
```

---

### Schema: query (CQRS Read Models)

```sql
-- Materialized view of campaign totals (optimized for reads)
CREATE TABLE query.campaign_totals (
  campaign_id UUID PRIMARY KEY,
  title VARCHAR(255),
  campaign_type VARCHAR(50),
  goal_amount DECIMAL(15, 2),
  raised_amount DECIMAL(15, 2) DEFAULT 0,
  donor_count INTEGER DEFAULT 0,
  last_donation_at TIMESTAMP,
  status VARCHAR(20),
  progress_percentage DECIMAL(5, 2) GENERATED ALWAYS AS 
    (CASE WHEN goal_amount > 0 THEN (raised_amount / goal_amount * 100) ELSE 0 END) STORED,
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Donation history (for user profiles and campaign pages)
CREATE TABLE query.donation_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pledge_id UUID NOT NULL,
  campaign_id UUID NOT NULL,
  campaign_title VARCHAR(255),
  donor_id UUID, -- nullable for anonymous
  donor_name VARCHAR(255),
  donor_email VARCHAR(255),
  amount DECIMAL(15, 2) NOT NULL,
  is_anonymous BOOLEAN DEFAULT false,
  message TEXT,
  donated_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- User donation statistics (cached aggregates)
CREATE TABLE query.user_statistics (
  user_id UUID PRIMARY KEY,
  total_donated DECIMAL(15, 2) DEFAULT 0,
  donation_count INTEGER DEFAULT 0,
  campaigns_supported INTEGER DEFAULT 0,
  first_donation_at TIMESTAMP,
  last_donation_at TIMESTAMP,
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Platform-wide statistics
CREATE TABLE query.platform_statistics (
  id INTEGER PRIMARY KEY DEFAULT 1, -- Single row table
  total_raised DECIMAL(15, 2) DEFAULT 0,
  total_campaigns INTEGER DEFAULT 0,
  total_donors INTEGER DEFAULT 0,
  total_donations INTEGER DEFAULT 0,
  active_campaigns INTEGER DEFAULT 0,
  updated_at TIMESTAMP DEFAULT NOW(),
  
  CONSTRAINT single_row CHECK (id = 1)
);

-- Indexes
CREATE INDEX idx_campaign_totals_status ON query.campaign_totals(status);
CREATE INDEX idx_campaign_totals_type ON query.campaign_totals(campaign_type);
CREATE INDEX idx_campaign_totals_progress ON query.campaign_totals(progress_percentage DESC);
CREATE INDEX idx_campaign_totals_raised ON query.campaign_totals(raised_amount DESC);

CREATE INDEX idx_donation_history_campaign ON query.donation_history(campaign_id, donated_at DESC);
CREATE INDEX idx_donation_history_donor ON query.donation_history(donor_id, donated_at DESC);
CREATE INDEX idx_donation_history_date ON query.donation_history(donated_at DESC);

CREATE INDEX idx_user_stats_total ON query.user_statistics(total_donated DESC);
```

---

### Schema: admin

```sql
-- Audit logs for all admin actions
CREATE TABLE admin.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL, -- references auth.users.id
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(50), -- campaign, payment, user, etc.
  entity_id UUID,
  details JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- System notifications for admins
CREATE TABLE admin.system_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type VARCHAR(50) NOT NULL, -- alert, warning, info
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  severity VARCHAR(20) CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  is_read BOOLEAN DEFAULT false,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_audit_logs_admin ON admin.audit_logs(admin_id, created_at DESC);
CREATE INDEX idx_audit_logs_entity ON admin.audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_logs_action ON admin.audit_logs(action);
CREATE INDEX idx_audit_logs_date ON admin.audit_logs(created_at DESC);

CREATE INDEX idx_system_notifications_unread ON admin.system_notifications(is_read, created_at DESC);
CREATE INDEX idx_system_notifications_severity ON admin.system_notifications(severity, created_at DESC);
```

---

## Event-Driven Architecture

### BullMQ Queue Configuration

```javascript
// Queue names
const QUEUES = {
  PLEDGE_EVENTS: 'pledge-events',
  PAYMENT_EVENTS: 'payment-events',
  CAMPAIGN_EVENTS: 'campaign-events',
  NOTIFICATION_EVENTS: 'notification-events',
  QUERY_UPDATES: 'query-updates'
};

// Event types
const EVENTS = {
  // Pledge events
  PLEDGE_CREATED: 'pledge.created',
  PLEDGE_PAYMENT_INITIATED: 'pledge.payment_initiated',
  PLEDGE_COMPLETED: 'pledge.completed',
  PLEDGE_FAILED: 'pledge.failed',
  PLEDGE_REFUNDED: 'pledge.refunded',
  
  // Payment events
  PAYMENT_PENDING: 'payment.pending',
  PAYMENT_AUTHORIZED: 'payment.authorized',
  PAYMENT_CAPTURED: 'payment.captured',
  PAYMENT_COMPLETED: 'payment.completed',
  PAYMENT_FAILED: 'payment.failed',
  PAYMENT_REFUNDED: 'payment.refunded',
  
  // Campaign events
  CAMPAIGN_CREATED: 'campaign.created',
  CAMPAIGN_UPDATED: 'campaign.updated',
  CAMPAIGN_ACTIVATED: 'campaign.activated',
  CAMPAIGN_GOAL_REACHED: 'campaign.goal_reached',
  CAMPAIGN_EXPIRED: 'campaign.expired',
  
  // Notification events
  SEND_EMAIL: 'notification.send_email',
  SEND_SMS: 'notification.send_sms'
};
```

### Event Flow Diagram

```
┌─────────────────┐
│  Pledge Service │
│  (Publisher)    │
└────────┬────────┘
         │
         │ 1. pledge.created
         ▼
┌─────────────────┐
│     BullMQ      │
│  (Event Bus)    │
└────────┬────────┘
         │
         ├─────────────────────┐
         │                     │
         ▼                     ▼
┌────────────────┐    ┌──────────────┐
│ Payment Service│    │Query Service │
│  (Subscriber)  │    │ (Subscriber) │
└────────┬───────┘    └──────────────┘
         │
         │ 2. payment.completed
         ▼
┌─────────────────┐
│     BullMQ      │
└────────┬────────┘
         │
         ├──────────┬──────────────┐
         │          │              │
         ▼          ▼              ▼
   ┌─────────┐ ┌────────┐  ┌─────────────┐
   │ Query   │ │ Notif  │  │   Campaign  │
   │ Service │ │Service │  │   Service   │
   └─────────┘ └────────┘  └─────────────┘
```

### Event Payload Examples

```javascript
// pledge.created
{
  eventId: 'uuid',
  eventType: 'pledge.created',
  timestamp: '2025-11-21T10:30:00Z',
  data: {
    pledgeId: 'uuid',
    campaignId: 'uuid',
    userId: 'uuid | null',
    amount: 1000.00,
    currency: 'BDT',
    donorEmail: 'donor@example.com',
    isAnonymous: false
  }
}

// payment.completed
{
  eventId: 'uuid',
  eventType: 'payment.completed',
  timestamp: '2025-11-21T10:31:00Z',
  data: {
    paymentId: 'uuid',
    pledgeId: 'uuid',
    campaignId: 'uuid',
    transactionId: 'SSLCZ123456',
    amount: 1000.00,
    paymentMethod: 'bkash',
    status: 'completed'
  }
}

// campaign.goal_reached
{
  eventId: 'uuid',
  eventType: 'campaign.goal_reached',
  timestamp: '2025-11-21T10:32:00Z',
  data: {
    campaignId: 'uuid',
    goalAmount: 100000.00,
    raisedAmount: 100500.00,
    donorCount: 150
  }
}
```

### Outbox Pattern Implementation

```javascript
// In Pledge Service - Creating a pledge with outbox

async function createPledge(pledgeData) {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // 1. Insert pledge
    const pledgeResult = await client.query(
      `INSERT INTO pledges.pledges (...) VALUES (...) RETURNING *`
    );
    const pledge = pledgeResult.rows[0];
    
    // 2. Insert outbox event (same transaction)
    await client.query(
      `INSERT INTO pledges.outbox (aggregate_id, event_type, payload) 
       VALUES ($1, $2, $3)`,
      [pledge.id, 'pledge.created', JSON.stringify(pledge)]
    );
    
    await client.query('COMMIT');
    
    return pledge;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

// Background worker - Process outbox
async function processOutbox() {
  setInterval(async () => {
    const events = await db.query(
      `SELECT * FROM pledges.outbox 
       WHERE processed = false 
       ORDER BY created_at ASC 
       LIMIT 10 FOR UPDATE SKIP LOCKED`
    );
    
    for (const event of events.rows) {
      try {
        // Publish to BullMQ
        await pledgeQueue.add(event.event_type, {
          eventId: event.id,
          eventType: event.event_type,
          timestamp: event.created_at,
          data: event.payload
        });
        
        // Mark as processed
        await db.query(
          `UPDATE pledges.outbox 
           SET processed = true, processed_at = NOW() 
           WHERE id = $1`,
          [event.id]
        );
      } catch (error) {
        // Increment retry count
        await db.query(
          `UPDATE pledges.outbox 
           SET retry_count = retry_count + 1 
           WHERE id = $1`,
          [event.id]
        );
      }
    }
  }, 1000); // Run every second
}
```

---

## API Design

### API Gateway Routes

```javascript
// API Gateway configuration
const routes = {
  // Auth routes
  '/api/auth/*': {
    target: 'http://auth-service:3001',
    rateLimit: { windowMs: 15 * 60 * 1000, max: 100 }
  },
  
  // Campaign routes
  '/api/campaigns': {
    target: 'http://campaign-service:3002',
    rateLimit: { windowMs: 15 * 60 * 1000, max: 200 },
    cache: { ttl: 60 } // Cache GET requests for 60s
  },
  
  // Pledge routes
  '/api/pledges': {
    target: 'http://pledge-service:3003',
    rateLimit: { windowMs: 15 * 60 * 1000, max: 100 }
  },
  
  // Payment routes
  '/api/payments': {
    target: 'http://payment-service:3004',
    rateLimit: { windowMs: 15 * 60 * 1000, max: 50 }
  },
  
  // Query routes (high read volume)
  '/api/query/*': {
    target: 'http://query-service:3005',
    rateLimit: { windowMs: 15 * 60 * 1000, max: 500 },
    cache: { ttl: 30 }
  },
  
  // Admin routes
  '/api/admin/*': {
    target: 'http://admin-service:3006',
    rateLimit: { windowMs: 15 * 60 * 1000, max: 200 },
    requireRole: 'ADMIN'
  },
  
  // Notification routes
  '/api/notifications/*': {
    target: 'http://notification-service:3007',
    rateLimit: { windowMs: 15 * 60 * 1000, max: 100 }
  }
};
```

### Standard API Response Format

```javascript
// Success response
{
  success: true,
  data: { ... },
  meta: {
    timestamp: '2025-11-21T10:30:00Z',
    requestId: 'uuid'
  }
}

// Error response
{
  success: false,
  error: {
    code: 'PAYMENT_FAILED',
    message: 'Payment could not be processed',
    details: { ... }
  },
  meta: {
    timestamp: '2025-11-21T10:30:00Z',
    requestId: 'uuid'
  }
}

// Paginated response
{
  success: true,
  data: [ ... ],
  pagination: {
    page: 1,
    limit: 20,
    total: 150,
    totalPages: 8
  },
  meta: {
    timestamp: '2025-11-21T10:30:00Z',
    requestId: 'uuid'
  }
}
```

### Key API Endpoints Summary

**Auth Service:**
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `POST /api/auth/refresh` - Refresh token
- `GET /api/auth/profile` - Get user profile

**Campaign Service:**
- `POST /api/campaigns` - Create campaign
- `GET /api/campaigns` - List campaigns (with filters)
- `GET /api/campaigns/:id` - Get campaign details
- `PUT /api/campaigns/:id` - Update campaign

**Pledge Service:**
- `POST /api/pledges` - Create pledge (registered/anonymous)
- `GET /api/pledges/:id` - Get pledge details
- `GET /api/pledges/user/:userId` - Get user's pledges

**Payment Service:**
- `POST /api/payments/initiate` - Initiate payment
- `POST /api/payments/webhook/ipn` - SSLCommerz webhook
- `GET /api/payments/:id` - Get payment details

**Query Service:**
- `GET /api/query/campaigns/:id/totals` - Get campaign totals (fast)
- `GET /api/query/campaigns/:id/donations` - Get donation history
- `GET /api/query/users/:id/donations` - Get user donations
- `GET /api/query/statistics/platform` - Platform statistics

**Admin Service:**
- `GET /api/admin/dashboard/stats` - Dashboard statistics
- `GET /api/admin/campaigns` - List all campaigns
- `PATCH /api/admin/campaigns/:id/approve` - Approve campaign
- `POST /api/admin/payments/:id/refund` - Refund payment

---

## Key Architectural Patterns

### 1. CQRS (Command Query Responsibility Segregation)

**Write Side (Command):**
- Campaign Service
- Pledge Service
- Payment Service

**Read Side (Query):**
- Query Service with optimized read models

**Benefits:**
- Optimized read queries (no joins needed)
- Scalable reads independently
- Pre-calculated aggregates
- No locking contention

### 2. Transactional Outbox Pattern

**Problem:** Ensure events are published even if message queue is down

**Solution:**
```
Transaction {
  1. Write to database (pledge, payment, etc.)
  2. Write event to outbox table
  Commit
}

Background worker {
  Read unprocessed events from outbox
  Publish to BullMQ
  Mark as processed
}
```

**Guarantees:**
- At-least-once delivery
- No lost events
- Survives message queue failures

### 3. Idempotency Pattern

**Problem:** Prevent duplicate operations from retries/webhooks

**Solution:**
```javascript
// Client generates idempotency key
const idempotencyKey = uuidv4();

// Server checks key
if (await existsIdempotencyKey(key)) {
  return cachedResponse;
}

// Process request
const response = await processPayment(...);

// Store response with key
await storeIdempotencyKey(key, response);

return response;
```

**Applied to:**
- Payment initiations
- Webhook processing
- Pledge creations

### 4. State Machine Pattern

**Payment State Machine:**
```
┌─────────┐
│ PENDING │
└────┬────┘
     │
     ▼
┌────────────┐     ┌────────┐
│ AUTHORIZED │────▶│ FAILED │
└────┬───────┘     └────────┘
     │
     ▼
┌──────────┐      ┌────────┐
│ CAPTURED │─────▶│ FAILED │
└────┬─────┘      └────────┘
     │
     ▼
┌───────────┐
│ COMPLETED │
└─────┬─────┘
      │
      ▼
┌──────────┐
│ REFUNDED │
└──────────┘
```

**Rules:**
- Only valid state transitions allowed
- State history tracked
- Prevents out-of-order webhooks

### 5. Event Sourcing (Lite)

**Not full event sourcing, but event-driven:**
- All state changes emit events
- Events stored in outbox
- Services react to events
- Audit trail maintained

### 6. API Gateway Pattern

**Responsibilities:**
- Single entry point
- Authentication/Authorization
- Rate limiting
- Request routing
- Response caching
- Load balancing

### 7. Saga Pattern (For distributed transactions)

**Example: Complete Donation Saga**
```
1. Create Pledge → pledge.created event
2. Initiate Payment → payment.initiated event
3. Process Payment → payment.completed event
4. Update Campaign Total → campaign.updated event
5. Send Notifications → notification.sent event

If any step fails:
- Compensating transactions
- Rollback via events
```

---

## Scalability Strategy

### Horizontal Scaling with Docker Compose

```yaml
# docker-compose.yml scaling configuration
services:
  campaign-service:
    image: careforall/campaign-service:latest
    deploy:
      replicas: 3  # Run 3 instances
    environment:
      - NODE_ENV=production
    
  query-service:
    image: careforall/query-service:latest
    deploy:
      replicas: 5  # More replicas for read-heavy service
    
  # Other services...
```

**Scaling Commands:**
```bash
# Scale specific service
docker-compose up --scale campaign-service=3 --scale query-service=5

# Scale all services
docker-compose up --scale campaign-service=3 \
                  --scale pledge-service=2 \
                  --scale payment-service=2 \
                  --scale query-service=5
```

### Load Balancing

**API Gateway Load Balancing:**
```javascript
// Round-robin load balancing
const serviceInstances = [
  'http://campaign-service-1:3002',
  'http://campaign-service-2:3002',
  'http://campaign-service-3:3002'
];

let currentIndex = 0;

function getNextInstance() {
  const instance = serviceInstances[currentIndex];
  currentIndex = (currentIndex + 1) % serviceInstances.length;
  return instance;
}
```

### Caching Strategy

**Redis Caching Layers:**

1. **API Gateway Cache:**
   - Cache GET responses
   - TTL: 30-60 seconds
   - Invalidate on write operations

2. **Query Service Cache:**
   - Hot campaigns (frequently accessed)
   - Campaign totals
   - TTL: 60 seconds

3. **Session Cache:**
   - User sessions
   - JWT blacklist
   - TTL: Token expiry time

**Cache Invalidation:**
```javascript
// On payment.completed event
await redis.del(`campaign:${campaignId}:totals`);
await redis.del(`campaign:${campaignId}:donations`);
```

### Database Optimization

**Read Replicas (Future):**
- Master: Write operations
- Replicas: Read operations (Query Service)

**Connection Pooling:**
```javascript
const pool = new Pool({
  max: 20,           // Max connections
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000
});
```

**Indexes:**
- All foreign keys indexed
- Status fields indexed
- Timestamp fields for sorting
- Full-text search indexes

### BullMQ Concurrency

```javascript
// Process multiple jobs concurrently
const worker = new Worker('pledge-events', async (job) => {
  // Process job
}, {
  concurrency: 10  // Process 10 jobs in parallel
});
```

### Performance Targets

| Operation | Target Latency | Target Throughput |
|-----------|---------------|-------------------|
| GET Campaign | < 100ms | 500 req/s |
| GET Totals | < 50ms | 1000 req/s |
| Create Pledge | < 500ms | 200 req/s |
| Process Payment | < 2s | 100 req/s |
| List Campaigns | < 200ms | 300 req/s |

---

## Security Considerations

### 1. Authentication & Authorization

**JWT Token Strategy:**
```javascript
// Access Token (short-lived)
{
  userId: 'uuid',
  email: 'user@example.com',
  role: 'USER',
  exp: '15 minutes'
}

// Refresh Token (long-lived)
{
  userId: 'uuid',
  tokenId: 'uuid',
  exp: '7 days'
}
```

**Password Security:**
- bcrypt with 10 rounds
- Minimum 8 characters
- Require email verification (bonus)

**API Key Security:**
- SSLCommerz credentials in environment variables
- Never commit secrets to git
- Use Docker secrets in production

### 2. Input Validation

**All inputs validated:**
- Email format validation
- Amount range checks
- SQL injection prevention (parameterized queries)
- XSS prevention (sanitize inputs)
- CSRF tokens for state-changing operations

### 3. Rate Limiting

**Per Route Limits:**
```javascript
// Auth endpoints
POST /api/auth/login: 5 req/min per IP

// Payment endpoints  
POST /api/payments/initiate: 10 req/min per user

// Query endpoints
GET /api/query/*: 100 req/min per user
```

### 4. Data Protection

**Encryption:**
- HTTPS/TLS for all communications
- Bcrypt for passwords
- Encrypted database connections

**PII Protection:**
- Anonymous donations don't require user account
- Email-only for anonymous donors
- Option to hide donor name publicly

**GDPR Compliance:**
- User data export (future)
- Right to be forgotten (future)
- Data retention policies

### 5. Payment Security

**SSLCommerz Security:**
- Webhook signature verification
- HTTPS-only webhooks
- IP whitelist for webhooks
- Transaction verification before fulfillment

**Idempotency:**
- Prevents duplicate charges
- Safe retries

**Audit Trail:**
- All payment state changes logged
- Full webhook payloads stored
- Admin action logs

---

## Infrastructure Setup

### Docker Compose Structure

```yaml
version: '3.8'

services:
  # API Gateway
  api-gateway:
    build: ./services/api-gateway
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - JWT_SECRET=${JWT_SECRET}
    depends_on:
      - redis
      - postgres

  # Auth Service
  auth-service:
    build: ./services/auth-service
    environment:
      - DATABASE_URL=postgresql://user:pass@postgres:5432/careforall
      - REDIS_URL=redis://redis:6379
      - JWT_SECRET=${JWT_SECRET}
    depends_on:
      - postgres
      - redis

  # Campaign Service
  campaign-service:
    build: ./services/campaign-service
    environment:
      - DATABASE_URL=postgresql://user:pass@postgres:5432/careforall
      - REDIS_URL=redis://redis:6379
    depends_on:
      - postgres
      - redis
    deploy:
      replicas: 2

  # Pledge Service
  pledge-service:
    build: ./services/pledge-service
    environment:
      - DATABASE_URL=postgresql://user:pass@postgres:5432/careforall
      - REDIS_URL=redis://redis:6379
    depends_on:
      - postgres
      - redis

  # Payment Service
  payment-service:
    build: ./services/payment-service
    environment:
      - DATABASE_URL=postgresql://user:pass@postgres:5432/careforall
      - REDIS_URL=redis://redis:6379
      - SSLCOMMERZ_STORE_ID=${SSLCOMMERZ_STORE_ID}
      - SSLCOMMERZ_STORE_PASSWORD=${SSLCOMMERZ_STORE_PASSWORD}
    depends_on:
      - postgres
      - redis

  # Query Service (CQRS Read Model)
  query-service:
    build: ./services/query-service
    environment:
      - DATABASE_URL=postgresql://user:pass@postgres:5432/careforall
      - REDIS_URL=redis://redis:6379
    depends_on:
      - postgres
      - redis
    deploy:
      replicas: 3

  # Notification Service
  notification-service:
    build: ./services/notification-service
    environment:
      - REDIS_URL=redis://redis:6379
      - SMTP_HOST=${SMTP_HOST}
      - SMTP_PORT=${SMTP_PORT}
      - SMTP_USER=${SMTP_USER}
      - SMTP_PASS=${SMTP_PASS}
    depends_on:
      - redis

  # Admin Service
  admin-service:
    build: ./services/admin-service
    environment:
      - DATABASE_URL=postgresql://user:pass@postgres:5432/careforall
      - REDIS_URL=redis://redis:6379
    depends_on:
      - postgres
      - redis

  # PostgreSQL
  postgres:
    image: postgres:16-alpine
    environment:
      - POSTGRES_DB=careforall
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=postgres
    volumes:
      - postgres-data:/var/lib/postgresql/data
      - ./init-db.sql:/docker-entrypoint-initdb.d/init.sql
    ports:
      - "5432:5432"

  # Redis (BullMQ + Cache)
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis-data:/data

  # Bull Board (BullMQ Monitoring UI)
  bull-board:
    build: ./services/bull-board
    ports:
      - "3100:3100"
    environment:
      - REDIS_URL=redis://redis:6379
    depends_on:
      - redis

  # Prometheus
  prometheus:
    image: prom/prometheus:latest
    ports:
      - "9090:9090"
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus-data:/prometheus

  # Grafana
  grafana:
    image: grafana/grafana:latest
    ports:
      - "3001:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
    volumes:
      - grafana-data:/var/lib/grafana
      - ./grafana/dashboards:/etc/grafana/provisioning/dashboards
    depends_on:
      - prometheus

  # Elasticsearch
  elasticsearch:
    image: docker.elastic.co/elasticsearch/elasticsearch:8.11.0
    environment:
      - discovery.type=single-node
      - xpack.security.enabled=false
    ports:
      - "9200:9200"
    volumes:
      - elasticsearch-data:/usr/share/elasticsearch/data

  # Logstash
  logstash:
    image: docker.elastic.co/logstash/logstash:8.11.0
    volumes:
      - ./logstash.conf:/usr/share/logstash/pipeline/logstash.conf
    depends_on:
      - elasticsearch

  # Kibana
  kibana:
    image: docker.elastic.co/kibana/kibana:8.11.0
    ports:
      - "5601:5601"
    environment:
      - ELASTICSEARCH_HOSTS=http://elasticsearch:9200
    depends_on:
      - elasticsearch

  # Jaeger (Distributed Tracing)
  jaeger:
    image: jaegertracing/all-in-one:latest
    ports:
      - "16686:16686"  # UI
      - "14268:14268"  # Collector
      - "6831:6831/udp"  # Agent

volumes:
  postgres-data:
  redis-data:
  prometheus-data:
  grafana-data:
  elasticsearch-data:

networks:
  default:
    name: careforall-network
```

### Environment Variables

```env
# .env file
NODE_ENV=production

# Database
DATABASE_URL=postgresql://postgres:postgres@postgres:5432/careforall

# Redis
REDIS_URL=redis://redis:6379

# JWT
JWT_SECRET=your-super-secret-jwt-key-change-in-production
JWT_EXPIRES_IN=15m
REFRESH_TOKEN_EXPIRES_IN=7d

# SSLCommerz
SSLCOMMERZ_STORE_ID=your-store-id
SSLCOMMERZ_STORE_PASSWORD=your-store-password
SSLCOMMERZ_API_URL=https://sandbox.sslcommerz.com
SSLCOMMERZ_WEBHOOK_URL=https://your-domain.com/api/payments/webhook/ipn

# SMTP (Nodemailer)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password

# Frontend URL
FRONTEND_URL=http://localhost:5173

# API Gateway
API_GATEWAY_PORT=3000

# Service Ports
AUTH_SERVICE_PORT=3001
CAMPAIGN_SERVICE_PORT=3002
PLEDGE_SERVICE_PORT=3003
PAYMENT_SERVICE_PORT=3004
QUERY_SERVICE_PORT=3005
ADMIN_SERVICE_PORT=3006
NOTIFICATION_SERVICE_PORT=3007
```

---

## Testing Strategy

### Unit Tests
- Test individual functions and methods
- Mock external dependencies
- Target: 80%+ code coverage per service

**Example:**
```javascript
// pledge-service.test.js
describe('PledgeService', () => {
  it('should create pledge with valid data', async () => {
    const pledgeData = {
      campaignId: 'uuid',
      amount: 1000,
      donorEmail: 'test@example.com'
    };
    
    const pledge = await pledgeService.createPledge(pledgeData);
    
    expect(pledge.id).toBeDefined();
    expect(pledge.status).toBe('pending');
  });
  
  it('should reject pledge with negative amount', async () => {
    const pledgeData = {
      campaignId: 'uuid',
      amount: -100,
      donorEmail: 'test@example.com'
    };
    
    await expect(pledgeService.createPledge(pledgeData))
      .rejects.toThrow('Amount must be positive');
  });
});
```

### Integration Tests
- Test service interactions
- Test database operations
- Test event publishing/consuming

**Example:**
```javascript
// pledge-payment-integration.test.js
describe('Pledge to Payment Flow', () => {
  it('should complete full donation flow', async () => {
    // 1. Create pledge
    const pledge = await request(app)
      .post('/api/pledges')
      .send({ campaignId, amount: 1000 })
      .expect(201);
    
    // 2. Initiate payment
    const payment = await request(app)
      .post('/api/payments/initiate')
      .send({ pledgeId: pledge.body.data.id })
      .expect(200);
    
    // 3. Simulate webhook
    await request(app)
      .post('/api/payments/webhook/ipn')
      .send({ transaction_id: payment.body.data.transactionId, status: 'VALID' })
      .expect(200);
    
    // 4. Verify pledge status
    const updatedPledge = await request(app)
      .get(`/api/pledges/${pledge.body.data.id}`)
      .expect(200);
    
    expect(updatedPledge.body.data.status).toBe('completed');
  });
});
```

### E2E Tests
- Test complete user journeys
- Test with real databases (test environment)
- Test observability stack integration

---

## Deployment Strategy

### Local Development
```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Scale specific service
docker-compose up --scale query-service=3 -d

# Stop all services
docker-compose down
```

### Production Deployment (DigitalOcean)
```bash
# Build images
docker-compose build

# Tag images
docker tag careforall/auth-service registry.digitalocean.com/careforall/auth-service:v1.0.0

# Push to registry
docker push registry.digitalocean.com/careforall/auth-service:v1.0.0

# Deploy with docker-compose
docker-compose -f docker-compose.prod.yml up -d
```

---

## Monitoring & Observability

### Metrics (Prometheus + Grafana)

**Key Metrics:**
- Request rate per service
- Error rate per endpoint
- Response time (p50, p95, p99)
- Database connection pool usage
- BullMQ queue size
- Redis memory usage
- Container CPU/Memory usage

**Dashboards:**
- Service health overview
- Payment processing metrics
- Campaign performance metrics
- System resource utilization

### Logging (ELK Stack)

**Log Levels:**
- ERROR: Failures that need immediate attention
- WARN: Potential issues
- INFO: Important business events
- DEBUG: Detailed debugging info

**Structured Logging:**
```javascript
logger.info('Pledge created', {
  pledgeId: pledge.id,
  campaignId: pledge.campaignId,
  amount: pledge.amount,
  userId: pledge.userId,
  timestamp: new Date().toISOString()
});
```

### Tracing (Jaeger)

**Trace Complete Donation Flow:**
```
Span 1: POST /api/pledges (Frontend → API Gateway → Pledge Service)
  Span 1.1: Insert pledge (Pledge Service → PostgreSQL)
  Span 1.2: Publish event (Pledge Service → BullMQ)
  
Span 2: Process pledge.created event (BullMQ → Payment Service)
  Span 2.1: Initiate SSLCommerz (Payment Service → SSLCommerz)
  
Span 3: Webhook received (SSLCommerz → Payment Service)
  Span 3.1: Update payment status (Payment Service → PostgreSQL)
  Span 3.2: Publish payment.completed (Payment Service → BullMQ)
  
Span 4: Update totals (BullMQ → Query Service)
  Span 4.1: Update read model (Query Service → PostgreSQL)
```

---

## CI/CD Pipeline

### GitHub Actions Workflow

```yaml
name: CI/CD Pipeline

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

jobs:
  detect-changes:
    runs-on: ubuntu-latest
    outputs:
      auth: ${{ steps.changes.outputs.auth }}
      campaign: ${{ steps.changes.outputs.campaign }}
      # ... other services
    steps:
      - uses: actions/checkout@v3
      - uses: dorny/paths-filter@v2
        id: changes
        with:
          filters: |
            auth:
              - 'services/auth-service/**'
            campaign:
              - 'services/campaign-service/**'
            # ... other services

  test-auth-service:
    needs: detect-changes
    if: needs.detect-changes.outputs.auth == 'true'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
      - name: Install dependencies
        run: cd services/auth-service && npm ci
      - name: Run tests
        run: cd services/auth-service && npm test
      - name: Run lint
        run: cd services/auth-service && npm run lint

  build-auth-service:
    needs: test-auth-service
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Build Docker image
        run: |
          cd services/auth-service
          docker build -t careforall/auth-service:${{ github.sha }} .
          docker tag careforall/auth-service:${{ github.sha }} careforall/auth-service:latest
      - name: Push to registry
        run: |
          echo ${{ secrets.DOCKER_PASSWORD }} | docker login -u ${{ secrets.DOCKER_USERNAME }} --password-stdin
          docker push careforall/auth-service:${{ github.sha }}
          docker push careforall/auth-service:latest

  # Repeat for other services...

  deploy:
    needs: [build-auth-service, build-campaign-service, ...]
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to production
        run: |
          # SSH into production server
          # Pull latest images
          # Run docker-compose up -d
```

---

## Next Steps & Timeline

### Checkpoint 1 (Current) - 2 hours
- ✅ Architecture design
- ✅ Data model design
- ✅ Service boundaries defined
- 🔲 Create architecture diagrams (use draw.io, Mermaid, or Excalidraw)
- 🔲 Review and refine with team

### Checkpoint 2 - 4 hours
- Setup project structure
- Implement all 8 services
- Setup Docker Compose
- Basic frontend (React)
- Write unit tests

### Checkpoint 3 - 1 hour
- Setup observability stack
- Configure Prometheus + Grafana
- Setup ELK stack
- Configure Jaeger tracing
- Create test scenarios

### Checkpoint 4 - 1 hour
- Create GitHub Actions workflows
- Setup CI/CD pipeline
- Configure Docker image builds
- Test automated deployment

---

## Conclusion

This architecture provides a solid foundation for the CareForAll platform with:

✅ **Fault Tolerance:** Outbox pattern, idempotency, state machines  
✅ **Scalability:** Horizontal scaling, caching, CQRS  
✅ **Observability:** Full monitoring, logging, and tracing  
✅ **Security:** JWT auth, input validation, rate limiting  
✅ **Reliability:** Event-driven architecture, retry mechanisms  
✅ **Performance:** Optimized queries, Redis caching, load balancing  

The system is designed to handle 1000+ req/s while maintaining data consistency and providing complete transparency for all stakeholders.

---

## Appendix

### Technology References
- Node.js: https://nodejs.org/
- Express.js: https://expressjs.com/
- PostgreSQL: https://www.postgresql.org/
- BullMQ: https://docs.bullmq.io/
- Redis: https://redis.io/
- SSLCommerz: https://sslcommerz.com/
- Docker: https://www.docker.com/
- Prometheus: https://prometheus.io/
- Grafana: https://grafana.com/
- ELK Stack: https://www.elastic.co/
- Jaeger: https://www.jaegertracing.io/

### Glossary
- **CQRS:** Command Query Responsibility Segregation
- **Outbox Pattern:** Transactional pattern for reliable event publishing
- **Idempotency:** Ability to apply operation multiple times without changing result
- **SSLCommerz:** Bangladesh payment gateway aggregator
- **BullMQ:** Redis-based queue system
- **JWT:** JSON Web Token for authentication
- **IPN:** Instant Payment Notification (webhook)

---

**Document Version:** 1.0  
**Last Updated:** November 21, 2025  
**Team:** API Avengers  
**Contact:** team@apiavengers.dev

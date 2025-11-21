-- CareForAll Platform Database Initialization
-- This script creates all schemas and tables for the microservices architecture

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- SCHEMA: auth
-- Owner: Auth Service
-- Purpose: User authentication and authorization
-- ============================================================================

CREATE SCHEMA IF NOT EXISTS auth;

-- Users table
CREATE TABLE IF NOT EXISTS auth.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(20) DEFAULT 'USER' CHECK (role IN ('USER', 'ADMIN')),
  is_active BOOLEAN DEFAULT true,
  email_verified BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- User profiles table
CREATE TABLE IF NOT EXISTS auth.user_profiles (
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

-- Refresh tokens table
CREATE TABLE IF NOT EXISTS auth.refresh_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  token VARCHAR(500) UNIQUE NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for auth schema
CREATE INDEX IF NOT EXISTS idx_users_email ON auth.users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON auth.users(role);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON auth.refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires ON auth.refresh_tokens(expires_at);

-- ============================================================================
-- SCHEMA: campaigns
-- Owner: Campaign Service
-- Purpose: Campaign management
-- ============================================================================

CREATE SCHEMA IF NOT EXISTS campaigns;

-- Campaigns table
CREATE TABLE IF NOT EXISTS campaigns.campaigns (
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

-- Indexes for campaigns schema
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns.campaigns(status);
CREATE INDEX IF NOT EXISTS idx_campaigns_organizer ON campaigns.campaigns(organizer_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_type ON campaigns.campaigns(campaign_type);
CREATE INDEX IF NOT EXISTS idx_campaigns_dates ON campaigns.campaigns(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_campaigns_created ON campaigns.campaigns(created_at DESC);

-- Full-text search index
CREATE INDEX IF NOT EXISTS idx_campaigns_search ON campaigns.campaigns
  USING gin(to_tsvector('english', title || ' ' || description));

-- ============================================================================
-- SCHEMA: pledges
-- Owner: Pledge Service
-- Purpose: Donation pledges and outbox pattern
-- ============================================================================

CREATE SCHEMA IF NOT EXISTS pledges;

-- Pledges table
CREATE TABLE IF NOT EXISTS pledges.pledges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL, -- references campaigns.campaigns.id
  user_id UUID, -- nullable for anonymous donations, references auth.users.id
  donor_email VARCHAR(255) NOT NULL,
  donor_name VARCHAR(255),
  amount DECIMAL(15, 2) NOT NULL CHECK (amount > 0),
  currency VARCHAR(3) DEFAULT 'BDT',
  status VARCHAR(20) DEFAULT 'pending' CHECK (
    status IN ('pending', 'payment_initiated', 'completed', 'failed', 'refunded', 'cancelled')
  ),
  is_anonymous BOOLEAN DEFAULT false,
  message TEXT,
  payment_reference VARCHAR(255), -- Reference to payment transaction ID
  metadata JSONB, -- Additional donor info
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Outbox pattern for reliable event publishing
CREATE TABLE IF NOT EXISTS pledges.outbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  aggregate_id UUID NOT NULL, -- pledge_id or other aggregate ID
  aggregate_type VARCHAR(50) NOT NULL, -- 'pledge', 'payment', etc.
  event_type VARCHAR(100) NOT NULL,
  payload JSONB NOT NULL,
  processed BOOLEAN DEFAULT false,
  retry_count INTEGER DEFAULT 0,
  last_error TEXT, -- Store last error message for debugging
  created_at TIMESTAMP DEFAULT NOW(),
  processed_at TIMESTAMP
);

-- Indexes for pledges schema
CREATE INDEX IF NOT EXISTS idx_pledges_campaign ON pledges.pledges(campaign_id);
CREATE INDEX IF NOT EXISTS idx_pledges_user ON pledges.pledges(user_id);
CREATE INDEX IF NOT EXISTS idx_pledges_status ON pledges.pledges(status);
CREATE INDEX IF NOT EXISTS idx_pledges_email ON pledges.pledges(donor_email);
CREATE INDEX IF NOT EXISTS idx_pledges_created ON pledges.pledges(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_outbox_processed ON pledges.outbox(processed, created_at);
CREATE INDEX IF NOT EXISTS idx_outbox_retry ON pledges.outbox(retry_count);

-- ============================================================================
-- SCHEMA: payments
-- Owner: Payment Service
-- Purpose: Payment processing and idempotency
-- ============================================================================

CREATE SCHEMA IF NOT EXISTS payments;

-- Payments table
CREATE TABLE IF NOT EXISTS payments.payments (
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
CREATE TABLE IF NOT EXISTS payments.idempotency_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  idempotency_key VARCHAR(255) UNIQUE NOT NULL,
  request_hash VARCHAR(255) NOT NULL, -- Hash of request body
  response JSONB,
  status_code INTEGER,
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP NOT NULL
);

-- Webhook tracking to prevent duplicate processing
CREATE TABLE IF NOT EXISTS payments.webhook_logs (
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
CREATE TABLE IF NOT EXISTS payments.payment_state_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID NOT NULL REFERENCES payments.payments(id),
  from_status VARCHAR(20),
  to_status VARCHAR(20) NOT NULL,
  reason TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for payments schema
CREATE INDEX IF NOT EXISTS idx_payments_pledge ON payments.payments(pledge_id);
CREATE INDEX IF NOT EXISTS idx_payments_transaction ON payments.payments(transaction_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments.payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_created ON payments.payments(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_idempotency_key ON payments.idempotency_keys(idempotency_key);
CREATE INDEX IF NOT EXISTS idx_idempotency_expires ON payments.idempotency_keys(expires_at);

CREATE INDEX IF NOT EXISTS idx_webhook_id ON payments.webhook_logs(webhook_id);
CREATE INDEX IF NOT EXISTS idx_webhook_processed ON payments.webhook_logs(processed, created_at);

CREATE INDEX IF NOT EXISTS idx_payment_history ON payments.payment_state_history(payment_id, created_at DESC);

-- ============================================================================
-- SCHEMA: query
-- Owner: Query Service (CQRS Read Models)
-- Purpose: Optimized read models for queries
-- ============================================================================

CREATE SCHEMA IF NOT EXISTS query;

-- Materialized view of campaign totals (optimized for reads)
CREATE TABLE IF NOT EXISTS query.campaign_totals (
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
CREATE TABLE IF NOT EXISTS query.donation_history (
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
CREATE TABLE IF NOT EXISTS query.user_statistics (
  user_id UUID PRIMARY KEY,
  total_donated DECIMAL(15, 2) DEFAULT 0,
  donation_count INTEGER DEFAULT 0,
  campaigns_supported INTEGER DEFAULT 0,
  first_donation_at TIMESTAMP,
  last_donation_at TIMESTAMP,
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Platform-wide statistics
CREATE TABLE IF NOT EXISTS query.platform_statistics (
  id INTEGER PRIMARY KEY DEFAULT 1, -- Single row table
  total_raised DECIMAL(15, 2) DEFAULT 0,
  total_campaigns INTEGER DEFAULT 0,
  total_donors INTEGER DEFAULT 0,
  total_donations INTEGER DEFAULT 0,
  active_campaigns INTEGER DEFAULT 0,
  updated_at TIMESTAMP DEFAULT NOW(),

  CONSTRAINT single_row CHECK (id = 1)
);

-- Initialize platform statistics
INSERT INTO query.platform_statistics (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- Indexes for query schema
CREATE INDEX IF NOT EXISTS idx_campaign_totals_status ON query.campaign_totals(status);
CREATE INDEX IF NOT EXISTS idx_campaign_totals_type ON query.campaign_totals(campaign_type);
CREATE INDEX IF NOT EXISTS idx_campaign_totals_progress ON query.campaign_totals(progress_percentage DESC);
CREATE INDEX IF NOT EXISTS idx_campaign_totals_raised ON query.campaign_totals(raised_amount DESC);

CREATE INDEX IF NOT EXISTS idx_donation_history_campaign ON query.donation_history(campaign_id, donated_at DESC);
CREATE INDEX IF NOT EXISTS idx_donation_history_donor ON query.donation_history(donor_id, donated_at DESC);
CREATE INDEX IF NOT EXISTS idx_donation_history_date ON query.donation_history(donated_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_stats_total ON query.user_statistics(total_donated DESC);

-- ============================================================================
-- SCHEMA: admin
-- Owner: Admin Service
-- Purpose: Admin operations and audit logging
-- ============================================================================

CREATE SCHEMA IF NOT EXISTS admin;

-- Audit logs for all admin actions
CREATE TABLE IF NOT EXISTS admin.audit_logs (
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
CREATE TABLE IF NOT EXISTS admin.system_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type VARCHAR(50) NOT NULL, -- alert, warning, info
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  severity VARCHAR(20) CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  is_read BOOLEAN DEFAULT false,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for admin schema
CREATE INDEX IF NOT EXISTS idx_audit_logs_admin ON admin.audit_logs(admin_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON admin.audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON admin.audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_date ON admin.audit_logs(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_system_notifications_unread ON admin.system_notifications(is_read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_system_notifications_severity ON admin.system_notifications(severity, created_at DESC);

-- ============================================================================
-- SCHEMA: notifications
-- Owner: Notification Service
-- Purpose: Email, SMS, and push notification management
-- ============================================================================

CREATE SCHEMA IF NOT EXISTS notifications;

-- Notification history table - tracks all sent notifications
CREATE TABLE IF NOT EXISTS notifications.notification_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_type VARCHAR(50) NOT NULL CHECK (notification_type IN ('email', 'sms', 'push', 'in_app')),
  event_type VARCHAR(100) NOT NULL,
  event_id VARCHAR(255), -- For deduplication
  recipient_email VARCHAR(255),
  recipient_phone VARCHAR(20),
  recipient_user_id UUID,
  subject VARCHAR(255),
  template_name VARCHAR(100),
  template_data JSONB,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'bounced')),
  error_message TEXT,
  sent_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Push notification subscriptions table
CREATE TABLE IF NOT EXISTS notifications.push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL, -- Public key
  auth TEXT NOT NULL, -- Auth secret
  user_agent TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for notifications schema
CREATE INDEX IF NOT EXISTS idx_notification_history_user
  ON notifications.notification_history(recipient_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notification_history_email
  ON notifications.notification_history(recipient_email, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notification_history_status
  ON notifications.notification_history(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notification_history_event
  ON notifications.notification_history(event_type, event_id);
CREATE INDEX IF NOT EXISTS idx_notification_history_type
  ON notifications.notification_history(notification_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user
  ON notifications.push_subscriptions(user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_endpoint
  ON notifications.push_subscriptions(endpoint);

-- ============================================================================
-- Grant permissions (adjust based on your security requirements)
-- ============================================================================

-- Grant usage on all schemas
GRANT USAGE ON SCHEMA auth, campaigns, pledges, payments, query, admin TO PUBLIC;

-- Grant permissions on all tables
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA auth TO PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA campaigns TO PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA pledges TO PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA payments TO PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA query TO PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA admin TO PUBLIC;

-- ============================================================================
-- Database initialization complete
-- ============================================================================

-- Log completion
DO $$
BEGIN
  RAISE NOTICE 'CareForAll database initialized successfully';
  RAISE NOTICE 'Schemas created: auth, campaigns, pledges, payments, query, admin';
END $$;

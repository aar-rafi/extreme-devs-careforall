# SSL Commerz Setup Guide

## Overview

This guide will help you set up SSL Commerz payment gateway integration for the CareForAll platform.

---

## ✅ What You Need

### 1. SSL Commerz Account

You need to sign up for an SSL Commerz account:

- **Sandbox (Testing):** https://developer.sslcommerz.com/registration/
- **Live (Production):** https://sslcommerz.com/merchant-registration/

### 2. Credentials Required

After registration, you'll receive:

| Credential | Description | Where to Find |
|-----------|-------------|---------------|
| **Store ID** | Your merchant store identifier | SSL Commerz Dashboard → Store Settings |
| **Store Password** | API authentication password | SSL Commerz Dashboard → Store Settings |

---

## 🚀 Setup Steps

### Step 1: Register for SSL Commerz Sandbox

1. Visit: https://developer.sslcommerz.com/registration/
2. Fill in the registration form:
   - **Store Name:** CareForAll (or your platform name)
   - **Business Type:** NGO/Non-Profit
   - **Contact Email:** Your email
   - **Phone:** Your phone number
3. Submit and wait for approval (usually instant for sandbox)

### Step 2: Get Your Credentials

Once approved:

1. Login to SSL Commerz Dashboard
2. Go to **Store Settings** or **API Credentials**
3. Copy your:
   - **Store ID** (e.g., `test63fa8c1d2e5c5`)
   - **Store Password** (e.g., `test63fa8c1d2e5c5@ssl`)

### Step 3: Configure Environment Variables

Create a `.env` file in your project root (if not exists):

```bash
cp .env.example .env
```

Edit `.env` and update these values:

```env
# SSLCommerz Payment Gateway
SSLCOMMERZ_STORE_ID=your-actual-store-id-here
SSLCOMMERZ_STORE_PASSWORD=your-actual-store-password-here
SSLCOMMERZ_API_URL=https://sandbox.sslcommerz.com
SSLCOMMERZ_WEBHOOK_URL=http://localhost:3000/api/payments/webhook/ipn

# For production, change to:
# SSLCOMMERZ_API_URL=https://securepay.sslcommerz.com
# SSLCOMMERZ_WEBHOOK_URL=https://your-production-domain.com/api/payments/webhook/ipn
```

### Step 4: Install Dependencies

```bash
cd services/payment-service
npm install
```

This will install:
- `sslcommerz-lts` - SSL Commerz SDK
- `axios` - HTTP client
- `joi` - Validation
- `uuid` - Unique IDs
- `crypto` - Hashing (Node.js built-in)

### Step 5: Configure Webhook URLs

**For Local Development:**

Since SSL Commerz needs to send webhooks to your server, you need a public URL.

**Option A: Use ngrok (Recommended for local testing)**

```bash
# Install ngrok
npm install -g ngrok
# or download from https://ngrok.com/

# Start ngrok
ngrok http 3000

# You'll get a URL like: https://abc123.ngrok.io
# Update your .env:
SSLCOMMERZ_WEBHOOK_URL=https://abc123.ngrok.io/api/payments/webhook/ipn
```

**Option B: Use a staging server**

Deploy to a server with a public IP and use that URL.

**For Production:**

```env
SSLCOMMERZ_WEBHOOK_URL=https://api.careforall.com/api/payments/webhook/ipn
```

### Step 6: Configure Webhook URLs in SSL Commerz Dashboard

1. Login to SSL Commerz Dashboard
2. Go to **Store Settings** → **API Configuration**
3. Set your webhook URLs:
   - **Success URL:** `https://your-domain.com/api/payments/webhook/success`
   - **Fail URL:** `https://your-domain.com/api/payments/webhook/fail`
   - **Cancel URL:** `https://your-domain.com/api/payments/webhook/cancel`
   - **IPN URL:** `https://your-domain.com/api/payments/webhook/ipn` (Most important!)

**Note:** For local testing with ngrok, update these with your ngrok URL.

### Step 7: Start the Services

```bash
# Start database and redis
docker-compose up -d postgres redis

# Initialize database
docker exec -i careforall-postgres psql -U postgres -d careforall < database/init-db.sql

# Start payment service
cd services/payment-service
npm run dev

# Or use docker-compose
docker-compose up payment-service
```

---

## 🧪 Testing the Integration

### Test with Sandbox Credentials

SSL Commerz provides test credentials for sandbox:

**Test Cards:**

| Card Type | Card Number | Expiry | CVV | Result |
|-----------|------------|--------|-----|--------|
| Visa | 4111 1111 1111 1111 | Any future | Any 3 digits | Success |
| MasterCard | 5425 2334 3010 9903 | Any future | Any 3 digits | Success |
| Amex | 3782 822463 10005 | Any future | Any 4 digits | Success |
| Failure Test | 4000 0000 0000 0002 | Any future | Any 3 digits | Failure |

**Test Mobile Banking:**

- **bKash:** Any phone number, OTP: `123456`
- **Nagad:** Any phone number, OTP: `123456`
- **Rocket:** Any phone number, OTP: `123456`

### Test Flow

1. **Create a test campaign:**
   ```bash
   curl -X POST http://localhost:3000/api/campaigns \
     -H "Authorization: Bearer YOUR_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "title": "Test Medical Campaign",
       "description": "Testing payment integration",
       "campaign_type": "medical",
       "goal_amount": 10000.00
     }'
   ```

2. **Create a pledge:**
   ```bash
   curl -X POST http://localhost:3000/api/pledges \
     -H "Authorization: Bearer YOUR_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "campaign_id": "YOUR_CAMPAIGN_ID",
       "amount": 100.00,
       "message": "Test donation"
     }'
   ```

3. **Initiate payment:**
   ```bash
   curl -X POST http://localhost:3000/api/payments/initiate \
     -H "Authorization: Bearer YOUR_TOKEN" \
     -H "Content-Type: application/json" \
     -H "X-Idempotency-Key: $(uuidgen)" \
     -d '{
       "pledge_id": "YOUR_PLEDGE_ID"
     }'
   ```

4. **Visit the gateway_url** from the response
5. **Complete payment** using test credentials
6. **Verify webhook** is received and processed

---

## 🔍 Verification Checklist

Use this checklist to verify everything is working:

- [ ] SSL Commerz credentials configured in `.env`
- [ ] Payment service starts without errors
- [ ] Can create pledges successfully
- [ ] Payment initiation returns `gateway_url`
- [ ] Can access SSL Commerz payment page
- [ ] Webhooks are received (check logs)
- [ ] Payment status updates to `completed`
- [ ] Pledge status updates to `completed`
- [ ] Campaign totals are updated (via Query service)
- [ ] Notification emails are sent

---

## 📊 Monitoring Webhooks

### Check Webhook Logs

```sql
-- In PostgreSQL
SELECT * FROM payments.webhook_logs
ORDER BY created_at DESC
LIMIT 10;
```

### Check Payment Status

```sql
-- Check payment status
SELECT id, pledge_id, transaction_id, status, payment_method, created_at
FROM payments.payments
ORDER BY created_at DESC
LIMIT 10;

-- Check payment state history
SELECT ph.*, p.transaction_id
FROM payments.payment_state_history ph
JOIN payments.payments p ON p.id = ph.payment_id
ORDER BY ph.created_at DESC
LIMIT 20;
```

### Check Service Logs

```bash
# Using docker-compose
docker-compose logs -f payment-service

# Look for:
# - "SSL Commerz service initialized"
# - "Payment initiated successfully"
# - "Received IPN webhook"
# - "Payment status updated"
```

---

## 🚨 Troubleshooting

### Issue: "SSL Commerz credentials not configured"

**Solution:**
```bash
# Verify .env file exists
ls -la .env

# Check if variables are set
cat .env | grep SSLCOMMERZ

# Restart service after updating .env
docker-compose restart payment-service
```

### Issue: Webhooks not received

**Possible causes:**
1. **Webhook URL not accessible** - Use ngrok for local testing
2. **Firewall blocking** - Check firewall settings
3. **Wrong URL configured** - Verify webhook URL in SSL Commerz dashboard

**Solution:**
```bash
# Test if webhook URL is accessible
curl https://your-ngrok-url.ngrok.io/api/payments/webhook/ipn

# Check payment service logs
docker-compose logs payment-service | grep webhook
```

### Issue: Payment initiation fails

**Check:**
1. **Valid pledge exists**
2. **Pledge status is 'pending'**
3. **No existing payment for pledge**
4. **Idempotency key is provided**

```bash
# Check pledge status
curl http://localhost:3000/api/pledges/YOUR_PLEDGE_ID \
  -H "Authorization: Bearer YOUR_TOKEN"

# Check if payment already exists
curl http://localhost:3000/api/payments/pledge/YOUR_PLEDGE_ID \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Issue: Payment stuck in "pending" status

**Possible causes:**
1. **Webhook not received** - Check SSL Commerz sent it
2. **Webhook processing failed** - Check logs
3. **Database transaction failed** - Check PostgreSQL logs

**Solution:**
```sql
-- Check webhook logs
SELECT * FROM payments.webhook_logs
WHERE payload->>'tran_id' = 'YOUR_TRANSACTION_ID';

-- Manually validate payment (if needed)
-- This will query SSL Commerz directly
curl -X POST http://localhost:3000/api/payments/YOUR_PAYMENT_ID/validate \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Issue: "Payment gateway error"

**Check:**
1. **Internet connectivity**
2. **SSL Commerz API is up** - Visit https://developer.sslcommerz.com/
3. **Credentials are correct**
4. **Store is active** - Check SSL Commerz dashboard

---

## 🔐 Security Best Practices

### Production Configuration

When going to production:

1. **Use HTTPS everywhere:**
   ```env
   SSLCOMMERZ_API_URL=https://securepay.sslcommerz.com
   SSLCOMMERZ_WEBHOOK_URL=https://api.careforall.com/api/payments/webhook/ipn
   FRONTEND_URL=https://careforall.com
   ```

2. **Get production credentials:**
   - Apply for live merchant account at https://sslcommerz.com/
   - Complete KYC verification
   - Get production Store ID and Password

3. **Enable webhook IP whitelisting:**
   - Get SSL Commerz webhook IPs
   - Configure firewall to only accept webhooks from these IPs

4. **Set NODE_ENV:**
   ```env
   NODE_ENV=production
   ```
   This automatically uses live SSL Commerz API.

5. **Secure your secrets:**
   - Never commit `.env` to git
   - Use environment variable management (e.g., AWS Secrets Manager)
   - Rotate credentials regularly

### Webhook Signature Verification

Currently implemented:
- ✅ Webhook deduplication via `webhook_id`
- ✅ Transaction validation with SSL Commerz API
- ✅ Payment existence check in database

Additional security (optional):
```javascript
// In webhookService.js, add signature verification
const crypto = require('crypto');

function verifyWebhookSignature(payload, signature) {
  const secret = process.env.SSLCOMMERZ_WEBHOOK_SECRET;
  const computedSignature = crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(payload))
    .digest('hex');

  return computedSignature === signature;
}
```

---

## 📞 Support

### SSL Commerz Support

- **Email:** integration@sslcommerz.com
- **Phone:** +880-2-9887692
- **Website:** https://sslcommerz.com/support
- **Docs:** https://developer.sslcommerz.com/

### Developer Documentation

- **API Docs:** https://developer.sslcommerz.com/doc/v4/
- **Integration Guide:** https://developer.sslcommerz.com/integration/
- **FAQ:** https://developer.sslcommerz.com/faq/

### CareForAll Integration Docs

- **Payment Integration Guide:** `docs/PAYMENT_INTEGRATION_GUIDE.md`
- **Architecture Document:** `CareForAll-Architecture-Design.md`

---

## 📋 Quick Reference

### Environment Variables Summary

```env
# Required
SSLCOMMERZ_STORE_ID=your-store-id
SSLCOMMERZ_STORE_PASSWORD=your-store-password

# Sandbox (default)
SSLCOMMERZ_API_URL=https://sandbox.sslcommerz.com

# Production
# SSLCOMMERZ_API_URL=https://securepay.sslcommerz.com

# Webhook URL (must be publicly accessible)
SSLCOMMERZ_WEBHOOK_URL=https://your-domain.com/api/payments/webhook/ipn
```

### Webhook Endpoints

All webhook endpoints automatically respond with `200 OK`:

- `/api/payments/webhook/success` - Payment successful
- `/api/payments/webhook/fail` - Payment failed
- `/api/payments/webhook/cancel` - Payment cancelled
- `/api/payments/webhook/ipn` - **Main webhook** (validates & completes payment)

### Testing Commands

```bash
# Check service health
curl http://localhost:3004/health

# Create pledge
curl -X POST http://localhost:3000/api/pledges \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"campaign_id":"ID","amount":100}'

# Initiate payment
curl -X POST http://localhost:3000/api/payments/initiate \
  -H "Authorization: Bearer TOKEN" \
  -H "X-Idempotency-Key: $(uuidgen)" \
  -H "Content-Type: application/json" \
  -d '{"pledge_id":"ID"}'

# Check payment status
curl http://localhost:3000/api/payments/pledge/PLEDGE_ID \
  -H "Authorization: Bearer TOKEN"
```

---

## ✅ Final Checklist

Before going live:

- [ ] SSL Commerz production account approved
- [ ] Production credentials configured
- [ ] Webhook URLs configured in SSL Commerz dashboard
- [ ] HTTPS enabled on all endpoints
- [ ] Database migrations applied
- [ ] All services running and healthy
- [ ] Tested complete payment flow
- [ ] Tested payment failure scenarios
- [ ] Tested webhook retry logic
- [ ] Monitoring and alerting configured
- [ ] Error handling tested
- [ ] Security review completed

---

**Version:** 1.0
**Last Updated:** November 21, 2025
**Maintained by:** API Avengers Team

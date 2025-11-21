# Payment Integration Guide - Frontend Implementation

## Overview

This guide explains how to integrate SSL Commerz payment gateway with the CareForAll platform frontend. The payment flow supports both registered and anonymous users.

**Last Updated:** November 21, 2025
**Version:** 1.0

---

## Table of Contents

1. [Payment Flow Overview](#payment-flow-overview)
2. [API Endpoints](#api-endpoints)
3. [Step-by-Step Integration](#step-by-step-integration)
4. [Request/Response Examples](#requestresponse-examples)
5. [Error Handling](#error-handling)
6. [Testing Guide](#testing-guide)
7. [Security Considerations](#security-considerations)
8. [FAQ](#faq)

---

## Payment Flow Overview

### High-Level Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         USER DONATION FLOW                               │
└─────────────────────────────────────────────────────────────────────────┘

[1] User clicks "Donate" button on campaign page
         │
         ▼
[2] User fills donation form (amount, message, etc.)
         │
         ▼
[3] Frontend creates pledge
    POST /api/pledges
         │
         ▼
[4] Pledge created (status: 'pending')
    Pledge ID: <uuid>
         │
         ▼
[5] Frontend initiates payment
    POST /api/payments/initiate
    Headers: {
      'X-Idempotency-Key': '<uuid>',
      'Authorization': 'Bearer <token>' (optional)
    }
    Body: {
      pledge_id: '<uuid>'
    }
         │
         ▼
[6] Payment service creates payment record
    Payment ID: <uuid>
    Transaction ID: CFA-xxx-xxx
    Status: 'pending'
         │
         ▼
[7] Payment service calls SSL Commerz API
    Gets gateway URL
         │
         ▼
[8] Frontend receives response with gateway_url
    Response: {
      payment_id: '<uuid>',
      transaction_id: 'CFA-xxx-xxx',
      gateway_url: 'https://sandbox.sslcommerz.com/...',
      amount: 1000.00,
      currency: 'BDT',
      status: 'pending'
    }
         │
         ▼
[9] Frontend redirects user to gateway_url
    User completes payment on SSL Commerz
         │
         ├─── SUCCESS ───────────────────┐
         │                               │
         ▼                               ▼
[10a] SSL Commerz redirects       [10b] SSL Commerz sends IPN webhook
      to success_url                     to backend
      (Frontend URL)                     POST /api/payments/webhook/ipn
         │                               │
         │                               ▼
         │                         Backend processes webhook
         │                         - Validates with SSL Commerz
         │                         - Updates payment status: 'completed'
         │                         - Publishes payment.completed event
         │                               │
         │                               ▼
         │                         Pledge status updated: 'completed'
         │                         Query service updates campaign totals
         │                         Notification service sends emails
         │
         ▼
[11] Frontend shows success page
     User sees confirmation

┌─────────────────────────────────────────────────────────────────────────┐
│                      PAYMENT FAILURE FLOW                                │
└─────────────────────────────────────────────────────────────────────────┘

[10a] SSL Commerz redirects to fail_url
         │
         ▼
[10b] SSL Commerz sends failure webhook
      Backend updates payment status: 'failed'
      Pledge status updated: 'failed'
         │
         ▼
[11] Frontend shows failure page
     User can retry or cancel
```

---

## API Endpoints

### Base URL
- **Development:** `http://localhost:3000/api`
- **Production:** `https://api.careforall.com/api`

### Authentication

**For Registered Users:**
```http
Authorization: Bearer <access_token>
```

**For Anonymous Users:**
- No authorization header required
- Provide email in pledge creation

---

### 1. Create Pledge

**Endpoint:** `POST /api/pledges`

**Headers:**
```json
{
  "Content-Type": "application/json",
  "Authorization": "Bearer <token>" // Optional for anonymous
}
```

**Request Body (Registered User):**
```json
{
  "campaign_id": "550e8400-e29b-41d4-a716-446655440000",
  "amount": 1000.00,
  "message": "Good luck with the campaign!",
  "is_anonymous": false
}
```

**Request Body (Anonymous User):**
```json
{
  "campaign_id": "550e8400-e29b-41d4-a716-446655440000",
  "donor_email": "donor@example.com",
  "donor_name": "John Doe",
  "amount": 500.00,
  "message": "Hope this helps!",
  "is_anonymous": false
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "data": {
    "id": "660e8400-e29b-41d4-a716-446655440001",
    "campaign_id": "550e8400-e29b-41d4-a716-446655440000",
    "user_id": "770e8400-e29b-41d4-a716-446655440002",
    "donor_email": "user@example.com",
    "donor_name": "Jane Smith",
    "amount": "1000.00",
    "currency": "BDT",
    "status": "pending",
    "is_anonymous": false,
    "message": "Good luck with the campaign!",
    "created_at": "2025-11-21T10:30:00.000Z",
    "updated_at": "2025-11-21T10:30:00.000Z"
  },
  "meta": {
    "timestamp": "2025-11-21T10:30:00.000Z",
    "requestId": "req-123"
  }
}
```

---

### 2. Initiate Payment

**Endpoint:** `POST /api/payments/initiate`

**IMPORTANT:** This endpoint requires an **Idempotency Key** to prevent duplicate payments.

**Headers:**
```json
{
  "Content-Type": "application/json",
  "X-Idempotency-Key": "unique-uuid-v4-here",
  "Authorization": "Bearer <token>" // Optional for anonymous
}
```

**Request Body:**
```json
{
  "pledge_id": "660e8400-e29b-41d4-a716-446655440001",
  "success_url": "https://careforall.com/payment/success",  // Optional
  "fail_url": "https://careforall.com/payment/failed",      // Optional
  "cancel_url": "https://careforall.com/payment/cancelled"  // Optional
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "data": {
    "payment_id": "880e8400-e29b-41d4-a716-446655440003",
    "transaction_id": "CFA-1700564400000-880e8400",
    "gateway_url": "https://sandbox.sslcommerz.com/gwprocess/v4/gw.php?Q=pay&SESSIONKEY=xxx",
    "amount": "1000.00",
    "currency": "BDT",
    "status": "pending"
  },
  "meta": {
    "timestamp": "2025-11-21T10:31:00.000Z",
    "requestId": "req-124"
  }
}
```

**Next Step:** Redirect user to `gateway_url`

---

### 3. Get Payment Status

**Endpoint:** `GET /api/payments/:paymentId`

**Headers:**
```json
{
  "Authorization": "Bearer <token>"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "id": "880e8400-e29b-41d4-a716-446655440003",
    "pledge_id": "660e8400-e29b-41d4-a716-446655440001",
    "transaction_id": "CFA-1700564400000-880e8400",
    "payment_method": "bkash",
    "amount": "1000.00",
    "currency": "BDT",
    "status": "completed",
    "gateway_response": {
      "status": "VALID",
      "tran_id": "CFA-1700564400000-880e8400",
      "val_id": "2401211713165DZ8mBrBfjMT7Io",
      "amount": "1000.00",
      "card_type": "bKash-bKash",
      "bank_tran_id": "2401211713MeC4H6FeC9V7gCuE4"
    },
    "created_at": "2025-11-21T10:31:00.000Z",
    "updated_at": "2025-11-21T10:33:00.000Z"
  }
}
```

---

### 4. Get Payment by Pledge ID

**Endpoint:** `GET /api/payments/pledge/:pledgeId`

**Response:** Same as Get Payment Status

---

## Step-by-Step Integration

### 1. Campaign Page - Donate Button

```typescript
// components/CampaignDonateButton.tsx

import { useState } from 'react';
import { v4 as uuidv4 } from 'uuid';

interface DonateButtonProps {
  campaignId: string;
  isAuthenticated: boolean;
}

export const DonateButton: React.FC<DonateButtonProps> = ({
  campaignId,
  isAuthenticated
}) => {
  const [showModal, setShowModal] = useState(false);

  const handleDonateClick = () => {
    setShowModal(true);
  };

  return (
    <>
      <button
        onClick={handleDonateClick}
        className="btn btn-primary"
      >
        Donate Now
      </button>

      {showModal && (
        <DonationModal
          campaignId={campaignId}
          isAuthenticated={isAuthenticated}
          onClose={() => setShowModal(false)}
        />
      )}
    </>
  );
};
```

---

### 2. Donation Form Modal

```typescript
// components/DonationModal.tsx

import { useState } from 'react';
import { createPledge, initiatePayment } from '../services/api';

interface DonationModalProps {
  campaignId: string;
  isAuthenticated: boolean;
  onClose: () => void;
}

export const DonationModal: React.FC<DonationModalProps> = ({
  campaignId,
  isAuthenticated,
  onClose
}) => {
  const [formData, setFormData] = useState({
    amount: '',
    message: '',
    donor_email: '',
    donor_name: '',
    is_anonymous: false
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Step 1: Create pledge
      const pledgeData = {
        campaign_id: campaignId,
        amount: parseFloat(formData.amount),
        message: formData.message,
        is_anonymous: formData.is_anonymous,
        // Include email/name only for anonymous users
        ...(isAuthenticated ? {} : {
          donor_email: formData.donor_email,
          donor_name: formData.donor_name
        })
      };

      const pledgeResponse = await createPledge(pledgeData, isAuthenticated);
      const pledgeId = pledgeResponse.data.id;

      // Step 2: Initiate payment
      const idempotencyKey = uuidv4(); // Generate unique key

      const paymentResponse = await initiatePayment(
        {
          pledge_id: pledgeId,
          // Optional: specify redirect URLs
          success_url: `${window.location.origin}/payment/success?pledge=${pledgeId}`,
          fail_url: `${window.location.origin}/payment/failed?pledge=${pledgeId}`,
          cancel_url: `${window.location.origin}/payment/cancelled?pledge=${pledgeId}`
        },
        idempotencyKey,
        isAuthenticated
      );

      // Step 3: Redirect to payment gateway
      window.location.href = paymentResponse.data.gateway_url;

    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to process donation');
      setLoading(false);
    }
  };

  return (
    <div className="modal">
      <div className="modal-content">
        <h2>Make a Donation</h2>

        <form onSubmit={handleSubmit}>
          {/* Amount */}
          <div className="form-group">
            <label>Amount (BDT) *</label>
            <input
              type="number"
              min="10"
              step="0.01"
              value={formData.amount}
              onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
              required
            />
          </div>

          {/* Anonymous user fields */}
          {!isAuthenticated && (
            <>
              <div className="form-group">
                <label>Email *</label>
                <input
                  type="email"
                  value={formData.donor_email}
                  onChange={(e) => setFormData({ ...formData, donor_email: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label>Name *</label>
                <input
                  type="text"
                  value={formData.donor_name}
                  onChange={(e) => setFormData({ ...formData, donor_name: e.target.value })}
                  required
                />
              </div>
            </>
          )}

          {/* Message */}
          <div className="form-group">
            <label>Message (Optional)</label>
            <textarea
              value={formData.message}
              onChange={(e) => setFormData({ ...formData, message: e.target.value })}
              rows={3}
            />
          </div>

          {/* Anonymous donation */}
          <div className="form-group">
            <label>
              <input
                type="checkbox"
                checked={formData.is_anonymous}
                onChange={(e) => setFormData({ ...formData, is_anonymous: e.target.checked })}
              />
              Make this donation anonymous
            </label>
          </div>

          {error && <div className="error">{error}</div>}

          <div className="form-actions">
            <button type="button" onClick={onClose} disabled={loading}>
              Cancel
            </button>
            <button type="submit" disabled={loading}>
              {loading ? 'Processing...' : 'Proceed to Payment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
```

---

### 3. API Service Functions

```typescript
// services/api.ts

import axios from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';

// Create axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token interceptor
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

/**
 * Create a pledge
 */
export const createPledge = async (pledgeData: any, authenticated: boolean = true) => {
  const config = authenticated ? {} : { headers: {} }; // No auth for anonymous
  const response = await api.post('/pledges', pledgeData, config);
  return response.data;
};

/**
 * Initiate payment for a pledge
 */
export const initiatePayment = async (
  paymentData: {
    pledge_id: string;
    success_url?: string;
    fail_url?: string;
    cancel_url?: string;
  },
  idempotencyKey: string,
  authenticated: boolean = true
) => {
  const headers: any = {
    'X-Idempotency-Key': idempotencyKey,
  };

  // Anonymous users don't need auth token
  if (!authenticated) {
    delete api.defaults.headers.common['Authorization'];
  }

  const response = await api.post('/payments/initiate', paymentData, { headers });
  return response.data;
};

/**
 * Get payment status
 */
export const getPaymentStatus = async (paymentId: string) => {
  const response = await api.get(`/payments/${paymentId}`);
  return response.data;
};

/**
 * Get payment by pledge ID
 */
export const getPaymentByPledge = async (pledgeId: string) => {
  const response = await api.get(`/payments/pledge/${pledgeId}`);
  return response.data;
};

/**
 * Get pledge by ID
 */
export const getPledge = async (pledgeId: string) => {
  const response = await api.get(`/pledges/${pledgeId}`);
  return response.data;
};
```

---

### 4. Payment Success Page

```typescript
// pages/payment/success.tsx

import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { getPaymentByPledge, getPledge } from '../../services/api';

export default function PaymentSuccess() {
  const router = useRouter();
  const { pledge } = router.query;
  const [loading, setLoading] = useState(true);
  const [paymentData, setPaymentData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (pledge) {
      verifyPayment(pledge as string);
    }
  }, [pledge]);

  const verifyPayment = async (pledgeId: string) => {
    try {
      // Wait a bit for webhook to process
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Get payment status
      const paymentResponse = await getPaymentByPledge(pledgeId);
      const pledgeResponse = await getPledge(pledgeId);

      setPaymentData({
        payment: paymentResponse.data,
        pledge: pledgeResponse.data
      });

      // Check if payment is completed
      if (paymentResponse.data.status !== 'completed') {
        // Poll for status update
        setTimeout(() => verifyPayment(pledgeId), 3000);
        return;
      }

      setLoading(false);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to verify payment');
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="container">
        <div className="loader">
          <h2>Verifying your payment...</h2>
          <p>Please wait while we confirm your donation.</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container">
        <div className="error-box">
          <h2>Verification Error</h2>
          <p>{error}</p>
          <button onClick={() => router.push('/')}>Go to Homepage</button>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="success-box">
        <div className="success-icon">✓</div>
        <h1>Thank You for Your Donation!</h1>

        <div className="payment-details">
          <p><strong>Amount:</strong> ৳{paymentData.payment.amount}</p>
          <p><strong>Transaction ID:</strong> {paymentData.payment.transaction_id}</p>
          <p><strong>Payment Method:</strong> {paymentData.payment.payment_method}</p>
          <p><strong>Status:</strong> {paymentData.payment.status}</p>
        </div>

        <div className="actions">
          <button onClick={() => router.push(`/campaigns/${paymentData.pledge.campaign_id}`)}>
            View Campaign
          </button>
          <button onClick={() => router.push('/profile/donations')}>
            View My Donations
          </button>
        </div>

        <p className="email-notice">
          A confirmation email has been sent to your registered email address.
        </p>
      </div>
    </div>
  );
}
```

---

### 5. Payment Failed Page

```typescript
// pages/payment/failed.tsx

import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { getPaymentByPledge } from '../../services/api';

export default function PaymentFailed() {
  const router = useRouter();
  const { pledge } = router.query;
  const [paymentData, setPaymentData] = useState<any>(null);

  useEffect(() => {
    if (pledge) {
      loadPaymentData(pledge as string);
    }
  }, [pledge]);

  const loadPaymentData = async (pledgeId: string) => {
    try {
      const response = await getPaymentByPledge(pledgeId);
      setPaymentData(response.data);
    } catch (err) {
      console.error('Failed to load payment data', err);
    }
  };

  const handleRetry = () => {
    // Redirect back to campaign page
    if (paymentData) {
      router.push(`/campaigns/${paymentData.campaign_id}`);
    } else {
      router.push('/');
    }
  };

  return (
    <div className="container">
      <div className="error-box">
        <div className="error-icon">✗</div>
        <h1>Payment Failed</h1>
        <p>We're sorry, but your payment could not be processed.</p>

        {paymentData?.error_message && (
          <div className="error-details">
            <p><strong>Reason:</strong> {paymentData.error_message}</p>
          </div>
        )}

        <div className="actions">
          <button onClick={handleRetry} className="btn-primary">
            Try Again
          </button>
          <button onClick={() => router.push('/')} className="btn-secondary">
            Go to Homepage
          </button>
        </div>

        <div className="help-section">
          <p>Need help? Contact our support team:</p>
          <p>Email: support@careforall.com</p>
          <p>Phone: +880 1234-567890</p>
        </div>
      </div>
    </div>
  );
}
```

---

## Request/Response Examples

### Complete Flow Example

#### 1. Create Pledge (Authenticated User)

**Request:**
```http
POST /api/pledges HTTP/1.1
Host: api.careforall.com
Content-Type: application/json
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

{
  "campaign_id": "550e8400-e29b-41d4-a716-446655440000",
  "amount": 1500.00,
  "message": "Keep up the great work!",
  "is_anonymous": false
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "660e8400-e29b-41d4-a716-446655440001",
    "campaign_id": "550e8400-e29b-41d4-a716-446655440000",
    "user_id": "770e8400-e29b-41d4-a716-446655440002",
    "donor_email": "user@example.com",
    "donor_name": "Jane Smith",
    "amount": "1500.00",
    "currency": "BDT",
    "status": "pending",
    "is_anonymous": false,
    "message": "Keep up the great work!",
    "payment_reference": null,
    "created_at": "2025-11-21T10:30:00.000Z",
    "updated_at": "2025-11-21T10:30:00.000Z"
  },
  "meta": {
    "timestamp": "2025-11-21T10:30:00.000Z",
    "requestId": "req-123"
  }
}
```

#### 2. Initiate Payment

**Request:**
```http
POST /api/payments/initiate HTTP/1.1
Host: api.careforall.com
Content-Type: application/json
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
X-Idempotency-Key: 9c4e7b8a-2f1d-4a9e-b5c3-8d7e6f5a4b3c

{
  "pledge_id": "660e8400-e29b-41d4-a716-446655440001",
  "success_url": "https://careforall.com/payment/success?pledge=660e8400-e29b-41d4-a716-446655440001",
  "fail_url": "https://careforall.com/payment/failed?pledge=660e8400-e29b-41d4-a716-446655440001",
  "cancel_url": "https://careforall.com/payment/cancelled?pledge=660e8400-e29b-41d4-a716-446655440001"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "payment_id": "880e8400-e29b-41d4-a716-446655440003",
    "transaction_id": "CFA-1700564400000-880e8400",
    "gateway_url": "https://sandbox.sslcommerz.com/gwprocess/v4/gw.php?Q=pay&SESSIONKEY=D94E5646ED8BECC54D84CBEE14C7D91E",
    "amount": "1500.00",
    "currency": "BDT",
    "status": "pending"
  },
  "meta": {
    "timestamp": "2025-11-21T10:31:00.000Z",
    "requestId": "req-124"
  }
}
```

#### 3. Check Payment Status (After Redirect)

**Request:**
```http
GET /api/payments/pledge/660e8400-e29b-41d4-a716-446655440001 HTTP/1.1
Host: api.careforall.com
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Response (Completed):**
```json
{
  "success": true,
  "data": {
    "id": "880e8400-e29b-41d4-a716-446655440003",
    "pledge_id": "660e8400-e29b-41d4-a716-446655440001",
    "transaction_id": "CFA-1700564400000-880e8400",
    "payment_method": "bkash",
    "amount": "1500.00",
    "currency": "BDT",
    "status": "completed",
    "gateway_response": {
      "status": "VALID",
      "tran_id": "CFA-1700564400000-880e8400",
      "val_id": "2401211713165DZ8mBrBfjMT7Io",
      "amount": "1500.00",
      "card_type": "bKash-bKash",
      "bank_tran_id": "2401211713MeC4H6FeC9V7gCuE4",
      "card_issuer": "bKash Mobile Banking",
      "card_brand": "MOBILEBANKING",
      "card_issuer_country": "Bangladesh",
      "card_issuer_country_code": "BD"
    },
    "error_message": null,
    "refund_reason": null,
    "refunded_at": null,
    "created_at": "2025-11-21T10:31:00.000Z",
    "updated_at": "2025-11-21T10:33:00.000Z"
  }
}
```

---

## Error Handling

### Error Response Format

All errors follow this format:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": {
      // Additional error details (optional)
    }
  },
  "meta": {
    "timestamp": "2025-11-21T10:30:00.000Z",
    "requestId": "req-123"
  }
}
```

### Common Error Codes

| HTTP Status | Error Code | Description | Action |
|-------------|-----------|-------------|---------|
| 400 | `VALIDATION_ERROR` | Invalid request data | Check request body |
| 400 | `IDEMPOTENCY_KEY_REQUIRED` | Missing idempotency key | Add X-Idempotency-Key header |
| 401 | `UNAUTHORIZED` | Invalid or missing auth token | Re-authenticate user |
| 403 | `FORBIDDEN` | User not allowed to perform action | Check permissions |
| 404 | `PLEDGE_NOT_FOUND` | Pledge does not exist | Verify pledge ID |
| 404 | `PAYMENT_NOT_FOUND` | Payment does not exist | Verify payment ID |
| 409 | `IDEMPOTENCY_KEY_CONFLICT` | Idempotency key reused with different data | Generate new key |
| 409 | `PAYMENT_ALREADY_EXISTS` | Payment already initiated for pledge | Use existing payment |
| 500 | `PAYMENT_GATEWAY_ERROR` | SSL Commerz API error | Retry or contact support |

### Example Error Handling

```typescript
// services/api.ts

export const handleApiError = (error: any) => {
  if (error.response) {
    // Server responded with error
    const { status, data } = error.response;
    const errorCode = data.error?.code;
    const errorMessage = data.error?.message || 'An error occurred';

    switch (errorCode) {
      case 'VALIDATION_ERROR':
        return 'Please check your input and try again.';

      case 'IDEMPOTENCY_KEY_REQUIRED':
        return 'Payment initialization failed. Please try again.';

      case 'UNAUTHORIZED':
        // Clear token and redirect to login
        localStorage.removeItem('access_token');
        window.location.href = '/login';
        return 'Session expired. Please log in again.';

      case 'PAYMENT_ALREADY_EXISTS':
        return 'Payment has already been initiated for this donation.';

      case 'PAYMENT_GATEWAY_ERROR':
        return 'Payment gateway is temporarily unavailable. Please try again later.';

      default:
        return errorMessage;
    }
  } else if (error.request) {
    // Request made but no response
    return 'Network error. Please check your internet connection.';
  } else {
    // Other errors
    return 'An unexpected error occurred. Please try again.';
  }
};
```

---

## Testing Guide

### Test Credentials (Sandbox)

SSL Commerz provides test cards for sandbox testing:

#### Test Cards

| Card Type | Card Number | Expiry | CVV | Result |
|-----------|------------|--------|-----|--------|
| Visa | 4111 1111 1111 1111 | Any future date | Any 3 digits | Success |
| MasterCard | 5425 2334 3010 9903 | Any future date | Any 3 digits | Success |
| Failure Test | 4000 0000 0000 0002 | Any future date | Any 3 digits | Failure |

#### Test Mobile Banking

- **bKash:** Use any phone number, enter OTP as `123456`
- **Nagad:** Use any phone number, enter OTP as `123456`
- **Rocket:** Use any phone number, enter OTP as `123456`

### Testing Flow

1. **Create Test Campaign**
   ```bash
   curl -X POST http://localhost:3000/api/campaigns \
     -H "Authorization: Bearer YOUR_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "title": "Test Campaign",
       "description": "Testing payment integration",
       "campaign_type": "medical",
       "goal_amount": 10000.00
     }'
   ```

2. **Create Test Pledge**
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

3. **Initiate Test Payment**
   ```bash
   curl -X POST http://localhost:3000/api/payments/initiate \
     -H "Authorization: Bearer YOUR_TOKEN" \
     -H "Content-Type: application/json" \
     -H "X-Idempotency-Key: $(uuidgen)" \
     -d '{
       "pledge_id": "YOUR_PLEDGE_ID"
     }'
   ```

4. **Visit Gateway URL**
   - Open the `gateway_url` from the response
   - Complete payment using test credentials

5. **Verify Payment**
   ```bash
   curl -X GET http://localhost:3000/api/payments/pledge/YOUR_PLEDGE_ID \
     -H "Authorization: Bearer YOUR_TOKEN"
   ```

### Test Scenarios

#### Scenario 1: Successful Payment (Registered User)
1. Login as registered user
2. Navigate to campaign page
3. Click "Donate Now"
4. Fill form with amount and message
5. Click "Proceed to Payment"
6. Complete payment on SSL Commerz
7. Verify redirect to success page
8. Check database for payment status = 'completed'

#### Scenario 2: Anonymous Donation
1. Navigate to campaign page (not logged in)
2. Click "Donate Now"
3. Fill form including email and name
4. Complete payment
5. Verify email received

#### Scenario 3: Payment Failure
1. Initiate payment
2. On SSL Commerz page, use failure test card
3. Verify redirect to failure page
4. Check database for payment status = 'failed'

#### Scenario 4: Payment Cancellation
1. Initiate payment
2. On SSL Commerz page, click "Cancel"
3. Verify redirect to cancel page
4. Check database for payment status = 'failed'

#### Scenario 5: Idempotency Check
1. Initiate payment with idempotency key X
2. Before completing payment, retry with same key
3. Verify same response returned (no duplicate payment)

---

## Security Considerations

### 1. Idempotency Keys

**Why:** Prevents duplicate payments if user refreshes or retries

**Implementation:**
```typescript
import { v4 as uuidv4 } from 'uuid';

// Generate unique key per payment attempt
const idempotencyKey = uuidv4();

// Store in session storage to reuse on retry
sessionStorage.setItem(`idempotency-${pledgeId}`, idempotencyKey);

// Use in request
await initiatePayment(paymentData, idempotencyKey);
```

**Important:**
- Generate once per pledge
- Store locally to reuse if network fails
- Don't reuse for different pledges

### 2. HTTPS Only

**All payment flows MUST use HTTPS:**
- API calls
- Redirect URLs
- Webhook endpoints

### 3. Token Storage

**Best Practices:**
```typescript
// Store access token securely
const storeToken = (token: string) => {
  // Use httpOnly cookie if possible
  // OR localStorage with XSS protection
  localStorage.setItem('access_token', token);
};

// Clear on logout
const logout = () => {
  localStorage.removeItem('access_token');
  // Clear other sensitive data
};
```

### 4. Input Validation

**Always validate on frontend:**
```typescript
const validateAmount = (amount: number) => {
  if (amount < 10) {
    throw new Error('Minimum donation is ৳10');
  }
  if (amount > 100000) {
    throw new Error('Maximum donation is ৳100,000');
  }
  return true;
};

const validateEmail = (email: string) => {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!regex.test(email)) {
    throw new Error('Invalid email format');
  }
  return true;
};
```

### 5. Never Trust Gateway Redirects

**Always verify payment status via API:**
```typescript
// DON'T just trust success URL
const verifyPayment = async (pledgeId: string) => {
  // Always fetch from backend
  const payment = await getPaymentByPledge(pledgeId);

  // Check status
  if (payment.status !== 'completed') {
    // Payment not confirmed yet
    return false;
  }

  return true;
};
```

---

## FAQ

### Q1: What if user closes browser during payment?

**A:** The payment will still be processed. When user returns:
1. Check pledge status via API
2. If payment completed, show success
3. If pending, show "Payment processing" message
4. If failed, allow retry

### Q2: How long does webhook processing take?

**A:** Typically 2-5 seconds. Implement polling on success page:

```typescript
const pollPaymentStatus = async (pledgeId: string, maxAttempts = 10) => {
  for (let i = 0; i < maxAttempts; i++) {
    const payment = await getPaymentByPledge(pledgeId);

    if (payment.status === 'completed') {
      return payment;
    }

    await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2s
  }

  throw new Error('Payment verification timeout');
};
```

### Q3: Can users donate without registering?

**A:** Yes! Anonymous donations are supported. Just collect email and name.

### Q4: What happens if payment gateway is down?

**A:**
1. Show user-friendly error message
2. Log error for monitoring
3. Suggest trying again later
4. Provide support contact info

### Q5: How to handle partial refunds?

**A:** Currently only full refunds are supported (admin only). Partial refunds coming in v2.

### Q6: Can I customize redirect URLs per campaign?

**A:** Yes, pass custom URLs in payment initiation:

```typescript
await initiatePayment({
  pledge_id: pledgeId,
  success_url: `${window.location.origin}/campaigns/${campaignId}/thanks`,
  fail_url: `${window.location.origin}/campaigns/${campaignId}/retry`,
  cancel_url: `${window.location.origin}/campaigns/${campaignId}`
});
```

### Q7: How to test webhooks locally?

**A:** Use ngrok or similar tool:

```bash
# Start ngrok
ngrok http 3000

# Update .env
SSLCOMMERZ_WEBHOOK_URL=https://your-ngrok-url.ngrok.io/api/payments/webhook/ipn

# Test payment - webhooks will hit your local server
```

### Q8: What data is stored in gateway_response?

**A:** Full SSL Commerz response including:
- Transaction IDs
- Card/payment method info
- Bank transaction ID
- Timestamps
- All metadata

### Q9: How to handle concurrent donations?

**A:** Idempotency keys prevent duplicates. Each donation gets unique key.

### Q10: Can I customize payment methods shown?

**A:** SSL Commerz controls available methods. You can't filter on frontend. Contact SSL Commerz support to configure allowed methods for your store.

---

## Support

For technical questions:
- **Email:** dev@careforall.com
- **Slack:** #payment-integration
- **Docs:** https://docs.careforall.com

For SSL Commerz issues:
- **Support:** https://sslcommerz.com/support
- **Docs:** https://developer.sslcommerz.com/

---

**Version:** 1.0
**Last Updated:** November 21, 2025
**Maintained by:** API Avengers Team

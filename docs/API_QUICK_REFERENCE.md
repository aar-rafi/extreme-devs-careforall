# CareForAll API Quick Reference

## 🚀 Quick Start with Swagger UI

### Option 1: Open Swagger UI in Browser
```bash
# From the project root
cd docs
# Open swagger-ui.html in your browser
# File path: file:///home/torr20/Documents/careforall/docs/swagger-ui.html
```

Or use a simple HTTP server:
```bash
cd docs
python3 -m http.server 8080
# Then open: http://localhost:8080/swagger-ui.html
```

### Option 2: Use Online Swagger Editor
1. Go to https://editor.swagger.io/
2. Copy contents of `docs/swagger.yaml`
3. Paste and start testing!

## 🔐 Authentication Flow

### 1. Login to Get Token
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "yourpassword"
  }'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": { ... },
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "..."
  }
}
```

### 2. Use Token in Swagger UI
1. Copy the `accessToken` from login response
2. Click the **"Authorize"** button at the top of Swagger UI
3. Enter: `Bearer <your-token-here>`
4. Click "Authorize"
5. All subsequent requests will automatically include the token! ✨

## 📝 Create Campaign API

### Endpoint
```
POST /api/campaigns
```

### Headers
```
Authorization: Bearer <your-token>
Content-Type: application/json
```

### Request Body
```json
{
  "title": "Help Save My Father's Life",
  "description": "My father needs urgent medical treatment for his heart condition. We need funds for surgery and post-operative care.",
  "campaign_type": "medical",
  "goal_amount": 500000,
  "beneficiary_name": "Mohammad Rahman",
  "beneficiary_details": "65-year-old patient at Dhaka Medical College Hospital",
  "image_url": "https://example.com/image.jpg",
  "end_date": "2025-12-31T23:59:59Z"
}
```

### Required Fields
- ✅ `title` (min 5, max 255 characters)
- ✅ `description` (min 20 characters)
- ✅ `campaign_type` (one of: `medical`, `education`, `emergency`, `long_term`)
- ✅ `goal_amount` (positive number)

### Optional Fields
- `start_date` (ISO date-time)
- `end_date` (ISO date-time, must be after start_date)
- `beneficiary_name` (max 255 characters)
- `beneficiary_details` (text)
- `image_url` (valid URI)
- `documents` (JSON object)

### cURL Example
```bash
curl -X POST http://localhost:3000/api/campaigns \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Help Save My Father'\''s Life",
    "description": "My father needs urgent medical treatment for his heart condition. We need funds for surgery.",
    "campaign_type": "medical",
    "goal_amount": 500000
  }'
```

### Success Response (201)
```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "title": "Help Save My Father's Life",
    "description": "...",
    "campaign_type": "medical",
    "goal_amount": 500000,
    "current_amount": 0,
    "status": "draft",
    "organizer_id": "user-uuid-here",
    "created_at": "2025-11-21T10:30:00Z",
    "updated_at": "2025-11-21T10:30:00Z"
  }
}
```

## 🔑 Other Important Endpoints

### Register New User
```bash
POST /api/auth/register
{
  "email": "user@example.com",
  "password": "SecurePass123!",
  "first_name": "John",
  "last_name": "Doe",
  "phone": "+8801234567890"
}
```

### List All Campaigns
```bash
GET /api/campaigns?page=1&limit=10&status=active&type=medical
```

### Get Campaign by ID
```bash
GET /api/campaigns/{campaign-id}
```

### Create Pledge (Donation)
```bash
POST /api/pledges
{
  "campaign_id": "campaign-uuid",
  "amount": 1000,
  "donor_email": "donor@example.com",
  "donor_name": "John Doe",
  "is_anonymous": false,
  "message": "Best wishes!"
}
```

### Initiate Payment (SSL Commerz)
```bash
POST /api/payments/initiate
Headers:
  Authorization: Bearer <token>
  X-Idempotency-Key: <unique-uuid>
Body:
{
  "pledge_id": "pledge-uuid",
  "payment_method": "bkash"
}
```

## 🎯 Campaign Types

- **`medical`**: Medical treatments, surgeries, healthcare
- **`education`**: School fees, scholarships, educational materials
- **`emergency`**: Natural disasters, urgent relief
- **`long_term`**: Community projects, infrastructure

## 📊 Campaign Status Flow

```
draft → active → completed
              ↘ cancelled
              ↘ expired
```

## 🛡️ Rate Limiting

**Note**: Rate limiting is now **disabled for localhost** in development mode!

Production limits:
- **Login/Register**: 5 requests per 15 minutes
- **General endpoints**: 100 requests per 15 minutes
- **API Gateway**: 10,000 requests per minute

## 🔗 API Base URLs

- **Local**: `http://localhost:3000`
- **VPS**: `http://51.222.28.107:3000`

## 💡 Pro Tips

1. **Swagger UI saves your auth token** - You only need to login once!
2. **Idempotency keys** are required for payment initiation (use UUID v4)
3. **ADMIN users** can update any campaign status
4. **Regular users** can only update their own campaigns
5. Use **query parameters** for filtering and pagination

## 📚 Full Documentation

- Swagger YAML: `docs/swagger.yaml`
- Swagger UI: `docs/swagger-ui.html`
- Database Schema: `database/init-db.sql`

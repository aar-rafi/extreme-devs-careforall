# Authentication Disabled for Demo

This document tracks all authentication restrictions that have been disabled for demo purposes.
To re-enable authentication, uncomment the code sections mentioned below.

## Client Application (`/client`)

### 1. Navbar Component (`client/components/navbar.tsx`)
- **Change**: Removed authentication requirement for "Start Campaign" link
- **Location**: Line 39-51
- **Action**: "Start Campaign" link is now always visible

### 2. Create Campaign Page (`client/app/campaigns/create/page.tsx`)
- **Change**: Disabled authentication redirect
- **Location**: Lines 44-48
- **Status**: Already commented out

### 3. Dashboard Page (`client/app/dashboard/page.tsx`)
- **Changes**:
  - Disabled useEffect authentication check (lines 21-26)
  - Disabled conditional return for non-authenticated users (lines 40-43)

## Admin Dashboard (`/admin-dashboard`)

### 1. Main Dashboard Page (`admin-dashboard/app/page.tsx`)
- **Changes**:
  - Disabled useEffect authentication check (lines 16-27)
  - Disabled conditional returns for non-authenticated users (lines 41-52)
  - Added null safety for user email display: `{user?.email || 'Admin User'}`

### 2. Campaigns Management Page (`admin-dashboard/app/campaigns/page.tsx`)
- **Changes**:
  - Disabled useEffect authentication check (lines 20-28)
  - Disabled loading state check (lines 48-55)
  - Disabled conditional return for non-admin users (lines 56-59)

## Production Environment Configuration

### VPS Deployment Configuration
- **Created**: `.env.production` file with VPS IP configuration
- **VPS IP**: 51.222.28.107
- **Key Variables**:
  - `NEXT_PUBLIC_API_URL=http://51.222.28.107:3000`
  - `FRONTEND_URL=http://51.222.28.107:4000`
  - `SSLCOMMERZ_WEBHOOK_URL=http://51.222.28.107:3000/api/payments/webhook/ipn`

### Docker Configuration Updates
- **Updated**: `docker-compose.yml` to pass `NEXT_PUBLIC_API_URL` as build args
- **Updated**: Both `client/Dockerfile` and `admin-dashboard/Dockerfile` to accept build args

## To Re-enable Authentication

To restore authentication, uncomment the disabled code sections in each file listed above.
The original authentication logic is preserved as comments and can be easily restored.

## Important Notes

1. This configuration is **for demo purposes only** and should not be used in production
2. Without authentication:
   - Anyone can create campaigns
   - Anyone can access the admin dashboard
   - User-specific features may not work properly
3. The API endpoints may still require authentication - only the frontend checks have been disabled
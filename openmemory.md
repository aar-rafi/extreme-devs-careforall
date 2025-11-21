## Overview
CareForAll is a microservices-based fundraising platform with two Next.js frontends:
- `client` for donors and campaign creators
- `admin-dashboard` for admins and operators

The frontends talk to an Express-based API Gateway (`services/api-gateway`) which routes traffic to individual Node.js microservices (auth, campaigns, pledges, payments, query, admin, notifications). PostgreSQL is used as a single database with separate schemas per service, Redis powers caching and BullMQ queues, and observability is handled via Prometheus, Grafana, ELK, and Jaeger.

## Architecture
- **Frontend**
  - `client/`: Public-facing Next.js app (App Router) with pages like `campaigns`, `campaigns/[id]`, `campaigns/create`, `dashboard`, `login`, `register`, and `payment/*`.
  - `admin-dashboard/`: Admin Next.js app for moderation, approvals, and platform oversight.
  - Both use React Query for data fetching, a shared design system (ShadCN-style `components/ui`), and a Zustand-based auth store (`stores/useAuthStore.ts`) that persists tokens and user info in `localStorage`.

- **API Layer**
  - `services/api-gateway`: Express gateway on port 3000 that terminates client HTTP requests and proxies to backend services:
    - `/api/auth/*` → `services/auth-service`
    - `/api/campaigns/*` → `services/campaign-service`
    - `/api/pledges/*` → `services/pledge-service`
    - `/api/payments/*` → `services/payment-service`
    - `/api/query/*` → `services/query-service`
    - `/api/admin/*` → `services/admin-service`
    - `/api/notifications/*` → `services/notification-service`

- **Core Backend Services**
  - `services/auth-service`: JWT auth, refresh tokens, profiles, roles.
  - `services/campaign-service`: Campaign CRUD and lifecycle; emits `campaign.*` events.
  - `services/pledge-service`: Pledges and Transactional Outbox; emits `pledge.*` events.
  - `services/payment-service`: SSLCommerz integration, idempotency, webhooks, payment state machine.
  - `services/query-service`: CQRS read models and fast queries for totals/history/statistics.
  - `services/admin-service`: Admin operations, approvals, audits.
  - `services/notification-service`: Email notifications and templates.

## User Defined Namespaces
- [Leave blank - user populates]

## Components (High-Level)
- **Client Frontend (`client/`)**
  - `app/layout.tsx` + `app/providers.tsx`: Global layout and providers (React Query, auth initialization).
  - `stores/useAuthStore.ts`: Manages `user`, `accessToken`, `refreshToken`, `isAuthenticated`, and `isLoading`, persisting to `localStorage`.
  - `lib/api/client.ts`: Axios instance configured with `NEXT_PUBLIC_API_URL`, attaches JWT from `localStorage`, and handles 401 responses via refresh token or redirect to `/login`.
  - `lib/api/*`: Typed API clients (auth, campaigns, pledges, donations, payments, etc.).
  - `components/navbar.tsx`: Top navigation; shows "Start Campaign" link and user menu when authenticated.
  - `app/campaigns/create/page.tsx`: Client-side form for creating campaigns using `campaignsApi.create`.

- **Admin Dashboard (`admin-dashboard/`)**
  - Mirrored structure to `client/`, with its own `stores/useAuthStore.ts`, `lib/api/*`, and admin-specific pages under `app/`.

- **Shared Backend (`shared/`)**
  - `shared/index.js`, `shared/middleware/*`, `shared/utils/*`, `shared/config/events.js`: Common logging, metrics, error handling, event definitions, and response helpers used by services.

## Patterns & Conventions
- **Auth**
  - JWT-based auth with short-lived access tokens and long-lived refresh tokens.
  - Frontends read tokens from `localStorage` and attach them via Axios interceptors.
  - On `401` responses, the client attempts `/api/auth/refresh` and, if that fails, clears tokens and redirects to `/client/app/login`.

- **Communication**
  - REST over HTTP for synchronous requests via API Gateway.
  - BullMQ over Redis for async events between services (pledge/payment/campaign/notification events).

- **Data & CQRS**
  - Single Postgres instance with separate schemas (`auth`, `campaigns`, `pledges`, `payments`, `query`, `admin`).
  - Query Service maintains denormalized read models (`query` schema) for fast reads.

- **Resilience**
  - Transactional Outbox in pledge service, idempotency keys + webhook logs in payment service.
  - Standardized success/error response format across services.



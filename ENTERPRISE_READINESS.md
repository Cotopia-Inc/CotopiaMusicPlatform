# Enterprise Readiness & Production Hardening

*Cotopia / Everyday Radio — completed July 2026*

This document records the production-hardening, enterprise-readiness, and buyer-due-diligence improvements applied to the platform. No existing features were removed. All demo/mock payment systems remain fully operational.

---

## 1. Payment Infrastructure — Demo Mode by Default

### What changed
- Added `paymentMode` column to `app_settings` (`demo` | `paypal_sandbox` | `paypal_live`), defaulting to `demo`.
- Upgraded `payments` table with: `provider`, `paymentMode`, `isDemo` (boolean), `externalTransactionId`, `demoConfirmationNumber`, normalized `status` (`initiated` / `completed` / `failed` / `refunded` / `disputed` / `canceled`).
- All new columns added via idempotent `ALTER TABLE IF NOT EXISTS` in `ensureTables()` — zero-downtime migration on startup.
- Demo payments now generate a real `demoConfirmationNumber` (format: `DEMO-XXXXXXXX`) stored in the database, so audit trails remain complete even in demo mode.
- Existing `"pending"` statuses auto-normalized to `"initiated"` on startup.

### Admin controls
- `GET /api/admin/payment-mode` — visible to `admin` and `master_admin`; returns current mode, credential status, and capability flags.
- `PATCH /api/admin/payment-mode` — `master_admin` only; validates PayPal credentials exist before allowing switch to sandbox or live mode.
- Live mode requires typing `ACTIVATE LIVE PAYMENTS` in a confirmation dialog before the API call is made.
- New sidebar entry: **Payment Settings** (master_admin only, at `/admin/payments/settings`).

### Transparency invariants
- Demo and real revenue are **never mixed** in the payments dashboard or reconciliation API.
- Summary cards clearly separate: demo totals (amber), sandbox totals (blue), live totals (green).
- Every demo payment record is flagged `isDemo = true` and labeled with a `DEMO` badge in the admin UI.

---

## 2. Payment Reconciliation API

- `GET /api/admin/payments/reconciliation` — paginated, filterable by `mode` and `status`.
- Response includes a `summary` object: demo / sandbox / live transaction counts and totals — always separated.
- `completed_real_total` only counts `paypal_live` + `isDemo = false` completed payments — never demo volume.

---

## 3. Health & Readiness Endpoints

| Endpoint | Auth | Purpose |
|---|---|---|
| `GET /api/health` | None | Full liveness check: DB probe, payment mode, uptime, environment |
| `GET /api/ready` | None | Lightweight readiness probe suitable for load balancer checks |

- `/health` runs a real DB query (`SELECT 1`) and reports the result in `checks.database`.
- Neither endpoint exposes secrets, stack traces, or environment variable values.
- Both are registered on the router before auth middleware — always available.

---

## 4. Security Hardening

### HTTP security headers (Helmet)
- `helmet` installed and configured in `app.ts`.
- `Content-Security-Policy` disabled for SPA compatibility (Vite, inline scripts).
- All other Helmet defaults active: `X-Content-Type-Options`, `X-Frame-Options`, `Strict-Transport-Security`, `X-XSS-Protection`, `Referrer-Policy`, `X-Permitted-Cross-Domain-Policies`.

### CORS
- In production, CORS is locked to `ALLOWED_ORIGINS` environment variable (comma-separated).
- In development, all origins are allowed for ease of local iteration.
- Credentials mode enabled.

### Startup validation
- API server refuses to start in `NODE_ENV=production` if `SESSION_SECRET` is missing or matches the insecure default `"change-me-in-production"`.
- Clear error message printed before process exit.

### JWT
- `SESSION_SECRET` is the only signing secret for JWTs (`cotopia_token` in localStorage).
- `optionalAuth` correctly passes through unauthenticated requests without crashing.

---

## 5. Submit Page — Demo Payment UX

- Payment step now clearly labels the flow as a demo transaction before the user initiates it.
- "Complete Demo Payment" button replaces the PayPal-branded button while in demo mode.
- After capture, the `demoConfirmationNumber` is displayed prominently on the success screen in monospace amber.
- Back button correctly clears all payment state (`paypalOrderId`, `demoConfirmationNumber`).

---

## 6. Admin Payment Settings Page

Located at `/admin/payments/settings` — master_admin only.

Features:
- Current mode displayed prominently.
- Three mode cards: Demo, PayPal Sandbox, PayPal Live — each showing credential status with green/red indicators.
- Sandbox/Live cards disabled if required environment variables are absent.
- Live mode protected by a type-to-confirm modal ("ACTIVATE LIVE PAYMENTS") in addition to the API's own credential check.
- All mode changes are logged server-side with actor, old mode, and new mode.

---

## 7. Automated Tests

New test file: `artifacts/api-server/src/__tests__/health-payment.test.ts`

Covers:
- `GET /api/health` — 200, correct shape, no secret leakage.
- `GET /api/ready` — 200, `ready: true`.
- `GET /api/admin/payment-mode` — 401 unauthenticated, 403 listener/moderator, 200 admin/master_admin.
- `PATCH /api/admin/payment-mode` — 401 unauthed, 403 listener/admin (not master_admin), 400 invalid mode, 200 demo mode, 422 sandbox/live without credentials.
- `GET /api/admin/payments/reconciliation` — 401 unauthed, 403 listener, 200 admin with correct summary shape; demo/real totals never mixed.

All tests added to the existing 82-test suite running with `vitest + supertest` against a real PostgreSQL database.

---

## 8. Database Migration Path

All schema changes are idempotent and applied automatically on every startup via `ensureTables()`:

```sql
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS "paymentMode" TEXT NOT NULL DEFAULT 'demo';
ALTER TABLE payments ADD COLUMN IF NOT EXISTS "provider" TEXT NOT NULL DEFAULT 'paypal';
ALTER TABLE payments ADD COLUMN IF NOT EXISTS "paymentMode" TEXT NOT NULL DEFAULT 'demo';
ALTER TABLE payments ADD COLUMN IF NOT EXISTS "isDemo" BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS "externalTransactionId" TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS "demoConfirmationNumber" TEXT;
-- Normalize legacy "pending" → "initiated"
UPDATE payments SET status = 'initiated' WHERE status = 'pending';
```

No manual migration step is required for this deployment.

---

## 9. Credential Security Principles

- PayPal credentials (Client ID, Client Secret) are **only** read from environment variables — never stored in the database.
- The admin UI shows whether credentials are present (boolean) but never their values.
- `SESSION_SECRET` is treated as critical and validated at startup.
- No secrets appear in health endpoint responses.

---

## 10. Remaining Optional Enhancements (not in scope)

The following are documented for future consideration and were explicitly kept out of scope to preserve existing functionality:

| Item | Notes |
|---|---|
| Real PayPal integration | Backend scaffolding complete; activate by setting `PAYPAL_CLIENT_ID` + `PAYPAL_CLIENT_SECRET` and switching mode via admin panel |
| Rate limiting | `express-rate-limit` is a drop-in; recommend per-IP limits on auth endpoints |
| Structured audit log | `admin_audit_logs` table exists; payment mode changes are already logged via `logger.info` |
| CSP for SPA | Requires a nonce strategy or hash list per Vite build; deferred |
| Refresh tokens | JWT currently expires per `SESSION_SECRET` config; refresh token rotation would improve security |

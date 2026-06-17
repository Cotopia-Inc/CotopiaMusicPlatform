---
name: Cotopia api-server test setup
description: How the safety/enforcement vitest suite is wired and the constraints that keep it from hanging or polluting data
---

# Cotopia api-server regression tests

The api-server has a vitest + supertest suite under `artifacts/api-server/src/__tests__/`
covering safety/enforcement flows (email-verification gates, blocking, message policy,
RBAC/enforcement tiers, registration age gate). Run via `pnpm --filter @workspace/api-server run test`.
Registered as the `test` validation command (validation skill) so it runs in the check pipeline.

## Constraints that matter

- **Tests hit the REAL database** (`DATABASE_URL` must be set). Each test creates its own
  users via `db.insert` and tears them down in `afterAll` with `cleanupUsers` (delete by id;
  every related table cascades on user delete). Use unique email/username suffixes to avoid
  collisions with seed data.
- **vitest must run with `NODE_ENV=production` + `LOG_LEVEL=silent`** (set in `vitest.config.ts`
  `test.env`). Otherwise pino-http spawns a pino-pretty worker thread that keeps the process
  alive and the run never exits.
- `fileParallelism: false` — files run serially so DB state stays isolated/deterministic.
- Test files live in `src/__tests__/` and are NOT bundled into `dist` (esbuild entry is only
  `src/index.ts`), so they don't affect the production build.
- Tests import the real Express `app` from `src/app.ts` and mint JWTs directly with `signToken`.

**Why:** the suite is full end-to-end against Express + DB, so the value is real regression
coverage, but it requires a live DB and the logger workaround to terminate cleanly.

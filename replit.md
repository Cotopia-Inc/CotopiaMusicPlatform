# Cotopia

A full-stack music and video streaming platform with role-based access, content discovery, social features, and an admin CMS.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm --filter @workspace/cotopia run dev` — run the Vite frontend
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/api-server run test` — run the safety/enforcement API regression tests (vitest + supertest; requires `DATABASE_URL`)
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/scripts run seed` — seed the database with demo data
- Required env: `DATABASE_URL` — Postgres connection string, `SESSION_SECRET` — JWT signing secret

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5 (`artifacts/api-server`)
- Frontend: React 19 + Vite 7 + Tailwind CSS 4 (`artifacts/cotopia`)
- DB: PostgreSQL + Drizzle ORM (`lib/db`)
- Auth: JWT (stored as `cotopia_token` in localStorage), bcryptjs
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec in `lib/api-spec`)
- Generated hooks: `lib/api-client-react`, generated schemas: `lib/api-zod`
- Build: esbuild (CJS bundle for API)

## Where things live

- `lib/db/src/schema/` — all 17 Drizzle table definitions (source of truth for DB)
- `lib/api-spec/openapi.yaml` — OpenAPI contract (~70 endpoints, source of truth for API)
- `artifacts/api-server/src/routes/` — 16 Express route files (auth, songs, videos, artists, labels, playlists, comments, favorites, submissions, library, home, discover, company, admin, payments)
- `artifacts/api-server/src/lib/auth.ts` — JWT helpers: `signToken`, `verifyToken`, `requireAuth`, `optionalAuth`, `requireRole`, `AuthRequest`
- `artifacts/cotopia/src/pages/` — all page components
- `artifacts/cotopia/src/lib/auth.tsx` — `AuthProvider`, `useAuth` hook
- `scripts/src/seed.ts` — database seed script

## Architecture decisions

- Contract-first: OpenAPI spec is written first, then Orval generates typed React Query hooks and Zod schemas. API routes use Zod schemas for input validation.
- JWT stored in localStorage as `cotopia_token`; `optionalAuth` middleware allows public access to content while enriching requests for logged-in users.
- PayPal payments are mocked (generates a fake order ID) — submission approval auto-publishes content.
- Featured content uses `isFeatured` boolean; trending content sorts by `playCount`/`viewCount` desc.
- Endpoints returning arrays (artists, labels, company posts, submissions) return plain arrays — NOT paginated `{items, total}` objects. Only songs/videos/discover endpoints are paginated.

## Product

- **Listeners**: Browse and stream songs/videos, follow artists, favorite tracks, manage playlists, view play history.
- **Artists**: Submit music and videos for review (with PayPal payment), manage their profile.
- **Labels**: Submit and manage artists/albums, company hub posts.
- **Admins**: Review/approve/reject submissions, manage users, configure app settings via CMS.
- **Company Hub**: Blog-style posts for announcements and spotlights.
- **Creator Support**: Demo-mode tipping (`/api/creator-support`, `/admin/creator-support`) — any artist, label, admin, editor, or moderator can enable Creator Support on their own account to receive tips on their profile, songs, or videos; supports a moderated public support wall and badges. No real payments are processed (demo transactions only); not available for podcasts (no podcast schema exists yet).

## Demo accounts (password: `password123`)

| Email | Role |
|---|---|
| admin@cotopia.org | master_admin |
| editor@cotopia.com | editor |
| mod@cotopia.com | moderator |
| alex@example.com | listener |
| nova@example.com | artist (Nova Sounds) |
| midnight@example.com | artist (Midnight Echo) |
| lyra@example.com | artist (Lyra Wave) |
| deepwave@example.com | label (Deep Wave Records) |
| neon@example.com | label (Neon Collective) |

## User preferences

- **"Push" / deploy always means Render** — unless explicitly stated otherwise, all deployment references are to the Render production environment.
- **Everything targets production** — all changes, fixes, and features are intended for production (Render) unless explicitly stated otherwise.

## Gotchas

- **Production DB migrations**: `ensureTables()` runs on every server startup and handles all schema additions automatically — NO manual `db push` is needed for any of the tables/columns below. Everything is idempotent (`ADD COLUMN IF NOT EXISTS`, `CREATE TABLE IF NOT EXISTS`). Covered as of Jul 2026: `users` social-URL cols + `deletion_requested_at`; `app_settings` tiered fee cols, payment mode, AI badge/review settings; `payments` audit cols; `songs`/`videos` full AI tagging + detection cols including `appeal_status`; `submissions` AI cols including `ai_override_reason`; `ai_detection_scans` table; `push_subscriptions` table; `creator_payment_settings` table; `support_transactions` table. When adding NEW columns to any schema file, always add the matching `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` (or `CREATE TABLE IF NOT EXISTS`) to `ensure-tables.ts` in the same PR — missing this is what caused the `appeal_status` production outage.
- Always run `pnpm run typecheck:libs` after changing any `lib/*` package before checking artifact types.
- After changing `lib/api-spec/openapi.yaml`, run `pnpm --filter @workspace/api-spec run codegen` to regenerate hooks and schemas.
- `@types/bcryptjs` and `bcryptjs` are in the pnpm catalog — use `catalog:` when adding them.
- The scripts package requires `@workspace/db: workspace:*` in dependencies to run seed.
- Endpoints returning plain arrays (not paginated): artists, labels, company posts, submissions, admin-submissions.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details

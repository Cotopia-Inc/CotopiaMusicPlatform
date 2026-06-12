# Cotopia

A full-stack music and video streaming platform with role-based access, content discovery, social features, and an admin CMS.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm --filter @workspace/cotopia run dev` — run the Vite frontend
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
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

## Demo accounts (password: `password123`)

| Email | Role |
|---|---|
| admin@cotopia.org | admin |
| alex@example.com | listener |
| nova@example.com | artist (Nova Sounds) |
| midnight@example.com | artist (Midnight Echo) |
| lyra@example.com | artist (Lyra Wave) |
| deepwave@example.com | label (Deep Wave Records) |
| neon@example.com | label (Neon Collective) |

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- Always run `pnpm run typecheck:libs` after changing any `lib/*` package before checking artifact types.
- After changing `lib/api-spec/openapi.yaml`, run `pnpm --filter @workspace/api-spec run codegen` to regenerate hooks and schemas.
- `@types/bcryptjs` and `bcryptjs` are in the pnpm catalog — use `catalog:` when adding them.
- The scripts package requires `@workspace/db: workspace:*` in dependencies to run seed.
- Endpoints returning plain arrays (not paginated): artists, labels, company posts, submissions, admin-submissions.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details

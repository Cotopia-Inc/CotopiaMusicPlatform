# Cotopia — Everyday Radio

> A full-stack music and video streaming platform with role-based access, content discovery, social features, and an admin CMS.

---

## What is Cotopia?

Cotopia powers **Everyday Radio** — an independent platform for music, video, discovery, promotion, and community. Artists submit their work, listeners discover new sounds, and a trusted moderation team keeps everything running smoothly.

### User Roles

| Role | What they can do |
|---|---|
| **Listener** | Stream songs & videos, follow artists, manage playlists, leave comments |
| **Artist** | Everything a listener can do, plus submit music & videos for review |
| **Label** | Submit and manage artists/albums, post to the Company Hub |
| **Editor** | Curate editorial playlists and featured content |
| **Moderator** | Review reports, manage comments, issue content warnings |
| **Admin** | Full platform management — submissions, users, CMS settings |
| **Master Admin** | All admin capabilities plus role assignment and platform configuration |

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Runtime** | Node.js 24, TypeScript 5.9 |
| **API** | Express 5 |
| **Frontend** | React 19, Vite 7, Tailwind CSS 4 |
| **Database** | PostgreSQL + Drizzle ORM |
| **Auth** | JWT (stored as `cotopia_token` in localStorage) |
| **Validation** | Zod (v4), drizzle-zod |
| **API Contract** | OpenAPI spec → Orval codegen (typed hooks + Zod schemas) |
| **Package Manager** | pnpm workspaces |

---

## Repository Structure

```
cotopia/
├── artifacts/
│   ├── api-server/          # Express API (port 5000)
│   └── cotopia/             # React + Vite frontend
├── lib/
│   ├── api-spec/            # OpenAPI contract (source of truth)
│   ├── api-client-react/    # Generated React Query hooks
│   ├── api-zod/             # Generated Zod schemas
│   └── db/                  # Drizzle ORM schema + migrations
└── scripts/                 # Seed scripts and utilities
```

---

## Getting Started

### Prerequisites

- Node.js 24+
- pnpm 9+
- PostgreSQL database

### Setup

```bash
# Install dependencies
pnpm install

# Set environment variables
# DATABASE_URL=postgres://...
# SESSION_SECRET=your-secret-here

# Push database schema
pnpm --filter @workspace/db run push

# Seed with demo data
pnpm --filter @workspace/scripts run seed

# Start both services (in separate terminals)
pnpm --filter @workspace/api-server run dev   # API at :5000
pnpm --filter @workspace/cotopia run dev      # Frontend at :5173
```

### Demo Accounts (password: `password123`)

| Email | Role |
|---|---|
| admin@cotopia.org | master_admin |
| editor@cotopia.com | editor |
| mod@cotopia.com | moderator |
| alex@example.com | listener |
| nova@example.com | artist |

---

## Development Commands

```bash
pnpm run typecheck                             # Full typecheck across all packages
pnpm run build                                 # Build all packages
pnpm --filter @workspace/api-spec run codegen # Regenerate hooks + schemas from OpenAPI
pnpm --filter @workspace/api-server run test  # Run API regression tests
pnpm --filter @workspace/db run push          # Push DB schema changes (dev only)
```

---

## Architecture Notes

- **Contract-first**: The OpenAPI spec (`lib/api-spec/openapi.yaml`) is the source of truth. Write the spec first, then run codegen to generate typed hooks and Zod schemas.
- **Auth**: JWT is attached as `Authorization: Bearer <token>`. The `optionalAuth` middleware allows public browsing while enriching requests for logged-in users.
- **Submissions**: Any authenticated user can submit content. The platform auto-creates an artist profile on first submission. Approved submissions are automatically published.
- **Payments**: PayPal integration (mocked in development — generates a fake order ID).

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines on how to submit bug fixes, features, and improvements.

## Security

See [SECURITY.md](SECURITY.md) for our vulnerability disclosure policy.

## Code of Conduct

See [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) for community standards.

---

## License

Copyright © 2025 Cotopia, Inc. All rights reserved.

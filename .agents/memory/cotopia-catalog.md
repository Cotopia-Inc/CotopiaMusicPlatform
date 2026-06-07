---
name: Cotopia catalog and scripts setup
description: Package catalog entries and scripts package wiring for Cotopia
---

bcryptjs entries added to `pnpm-workspace.yaml` catalog:
- `bcryptjs: ^2.4.3`
- `@types/bcryptjs: ^2.4.6`

The `scripts` package (`@workspace/scripts`) requires:
- `@workspace/db: workspace:*` in **dependencies** (not devDeps) to import Drizzle schemas for seeding
- `bcryptjs: catalog:` in dependencies
- `@types/bcryptjs: catalog:` in devDeps

**Why:** `@types/bcryptjs` was not in the original catalog, causing pnpm install errors. Workspace packages must declare all cross-package deps explicitly.

**How to apply:** When adding new scripts that import workspace libs, always add them to scripts/package.json dependencies with `workspace:*` and run `pnpm install` from the root.

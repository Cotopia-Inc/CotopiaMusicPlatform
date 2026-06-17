---
name: Cotopia api-server has no HMR
description: Why new/changed API routes 404 until the api-server workflow is restarted
---

The `artifacts/api-server` dev workflow runs `pnpm run build && pnpm run start` — it bundles
a single esbuild CJS/MJS file once and runs the compiled output. There is **no hot reload**.

**Why:** changes to route files (e.g. `routes/safety.ts`) do NOT take effect in the running
server until you restart the workflow. Symptom: newly added endpoints return
`Cannot GET/POST ...` (Express 404) even though the route is correctly mounted in
`routes/index.ts` and typecheck passes.

**How to apply:** after editing any api-server source, restart the
`artifacts/api-server: API Server` workflow before smoke-testing endpoints with curl. The Vite
frontend (`artifacts/cotopia`) DOES hot-reload, so only the API side needs the manual restart.

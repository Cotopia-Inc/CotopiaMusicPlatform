---
name: Cotopia production schema drift (missing tables)
description: New Drizzle tables can exist in dev but not on Render production; ensureTables() does NOT cover them — causes generic "Could not X" toasts with no visible error.
---

## The issue

`artifacts/api-server/src/lib/ensure-tables.ts` is a hand-maintained list of `CREATE TABLE IF NOT EXISTS` statements for a handful of legacy tables (badges, user_badges, bug_reports, experience_feedback, feature_suggestions) plus one `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`. It runs on every server boot, including on Render.

**It is NOT kept in sync with `lib/db/src/schema/`.** Any *new* Drizzle table added there (not just new columns) will exist in the dev Neon DB (created via `pnpm --filter @workspace/db run push`) but will silently NOT exist on Render production unless someone explicitly pushes the schema there too.

**Why:** the app has two independent schema-sync paths — the manual `ensure-tables.ts` allowlist (runs automatically everywhere) and Drizzle's `db push` (must be run manually against the target DB). New tables only get the latter; if that step is skipped for production, every DB write against the missing table throws a "relation does not exist" error that generic frontend `onError` handlers surface only as a vague toast (e.g. "Could not add event"), with no indication it's a schema problem.

## How to apply

- When investigating "works in dev, fails in prod" reports for a *recently added* feature (check `git log` on the relevant schema file), suspect a missing production table/column first, especially if the schema file is only days old.
- `RENDER_DATABASE_URL` secret is available in this workspace and points at the Render production Postgres — use `psql "$RENDER_DATABASE_URL" -c "\dt"` to check what tables actually exist there. Note: this DB is NOT reachable via the `executeSql` tool's `environment: "production"` option (that only works for Replit-provisioned Neon DBs); use `psql`/raw SQL directly instead.
- `drizzle-kit push --config lib/db/drizzle.config.ts` reads `DATABASE_URL` directly (not a Render-specific var). Two separate blockers when pointed at `RENDER_DATABASE_URL`: (1) it hangs silently unless `?sslmode=require` is appended to the URL (Render requires SSL, raw URL has no sslmode param); (2) even with SSL fixed, if the diff touches ANY unrelated table drift (e.g. an existing table getting a new unique constraint), drizzle-kit prompts interactively and fails with "Interactive prompts require a TTY" in this non-interactive shell — `--force` does NOT skip this specific prompt. The reliable fallback is issuing the equivalent `CREATE TABLE IF NOT EXISTS ...` SQL by hand (a small pg client script run from inside a workspace package like `lib/db` so `pg` resolves, with `ssl: { rejectUnauthorized: false }`), matching the Drizzle schema file's column defs/types/constraints exactly — this only touches the intended new tables and avoids unrelated drift entirely.
- After adding any new table to `lib/db/src/schema/`, treat pushing it to Render production as a required deploy step, same as the existing "new columns" gotcha already noted in replit.md — it applies to whole new tables too, not just columns.

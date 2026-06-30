---
name: Cotopia badge definitions — nullable color & no API delete
description: Gotchas for the admin badge create/edit feature: color is optional/nullable, and badge definitions can't be deleted via the API.
---

# Badge color is optional/nullable

The `badges.color` column is nullable — a badge can have no color at all. Admins
can save any non-empty string (hex like `#762af8` OR CSS named colors like `gold`),
or leave it blank to store `null`.

**How to apply:** every render site that reads `badge.color` must fall back to
`DEFAULT_BADGE_COLOR` (exported from `badge-chip.tsx`) because the value can be
`null`. PATCH must set `color` to `null` when the field is cleared (send `color: ""`),
not silently keep the old value.

# "Something went wrong saving the badge" was a duplicate-name 500

The user-reported recurring save failure was a Postgres unique-violation (code
`23505`) on `badges_name_unique`, surfaced as a generic 500. POST/PATCH now map
`23505` → friendly **409**.

**Why this kept recurring:** when verifying the fix, creating a test badge with the
SAME name the user intends to use makes the user's later save collide on the unique
name constraint. Always namespace test badge names (e.g. `qa_live_*`) AND delete them
afterward.

# Badge definitions have NO API delete route

There is only `DELETE /admin/user-badges/:id` (removes an *award*), NOT a route to
delete a badge *definition*. The admin UI can only deactivate (`isActive=false`).

**How to apply:** curl/e2e cleanup of test badge definitions will 404. Remove leftover
test badges directly via SQL: `DELETE FROM badges WHERE name LIKE 'qa_%'`.

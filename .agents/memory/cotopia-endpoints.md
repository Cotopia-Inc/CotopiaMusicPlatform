---
name: Cotopia array vs paginated endpoints
description: Which Cotopia API endpoints return plain arrays vs paginated objects
---

Endpoints that return **plain arrays** (NOT `{items, total}`):
- GET /api/artists
- GET /api/labels
- GET /api/company/posts
- GET /api/submissions (user's own)
- GET /api/admin/submissions

Endpoints that return **paginated objects** `{items: [], total: number}`:
- GET /api/songs
- GET /api/videos
- GET /api/discover/...

**Why:** The OpenAPI spec defined array-returning endpoints without pagination wrappers. The design subagent incorrectly used `.items` on all endpoints. Frontend code must use `data?.length` / `data.map(...)` for array endpoints.

**How to apply:** When writing frontend code for these pages, access the data directly as an array. For paginated endpoints, use `data?.items`.

---
name: Cotopia generic error toast diagnosis
description: How to diagnose a generic "Please try again" style error toast in the Cotopia frontend
---

When a mutation's `onError` handler is written as `err?.data?.error ?? "Please try again."` (the standard pattern here) and the user sees the literal fallback text, it means `err.data` was not a structured JSON object — i.e. the response body wasn't `{ error: "..." }` shaped JSON. This happens when:

- The api-server was serving stale code because it wasn't restarted after a route was added/changed (api-server has no HMR — see the "no HMR" memory entry). A request to a route that doesn't exist yet in the running process returns Express's default 404 HTML page, not JSON.
- An unhandled exception crashed the route and Express's default error handler returned an HTML error page instead of JSON (there's no catch-all JSON error middleware for arbitrary thrown errors, only for `entity.too.large` in `app.ts`).

**Why:** `customFetch`'s `ApiError.data` is whatever `parseErrorBody` returns — for `text/html` responses this is a raw string, so `err.data.error` is `undefined` and the UI falls back to the generic message. This looks identical to "the feature is broken" but is actually a stale-build or unhandled-exception issue.

**How to apply:** Before debugging route/validation logic for a "please try again" report, first restart the api-server workflow and retry. If it still reproduces, check for an actual unhandled exception in the route (crash → HTML response) rather than assuming the JSON error path is broken.

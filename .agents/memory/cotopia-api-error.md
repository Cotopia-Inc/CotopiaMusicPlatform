---
name: Cotopia ApiError shape
description: How to read server error messages from onError handlers — err.data not err.response.data
---

## The rule

In `onError` handlers for Orval-generated mutations, read the server error string as:

```ts
err?.data?.error ?? "fallback message"
```

**Never** use `err?.response?.data?.error` — that path is always `undefined`.

**Why:** `customFetch` throws `ApiError` (see `lib/api-client-react/src/custom-fetch.ts`).
`ApiError` has:
- `err.data` — the parsed JSON response body (e.g. `{ error: "Current password is incorrect" }`)
- `err.response` — the raw browser `Response` object, which has no `.data` property

Using `err.response.data` silently returns `undefined`, causing every error to fall back to the hardcoded string regardless of what the server actually said.

**How to apply:** Any time you write an `onError` handler for an Orval mutation, use `err?.data?.error`. Also applies to `err?.data?.message` or other body fields. Check existing handlers when touching a file — the wrong pattern has appeared in profile.tsx and register.tsx and may appear in new code if copied from old examples.

---
name: Cotopia Web Push architecture
description: How Web Push notifications are wired up in Cotopia — notify() helper, push subscription storage, service worker, and the broadcast tx edge case.
---

## Rule
Use `notify()` from `artifacts/api-server/src/lib/notify.ts` for ALL notification insertions. It does `db.insert(notificationsTable)` + fires push notifications to the user's registered devices in one call.

**Why:** Before the helper existed, all 21 `db.insert(notificationsTable)` sites were scattered across 8 files. `notify()` centralises the pattern so push delivery is never forgotten when adding new notification types.

**How to apply:**
- Single insert: `await notify({ userId, type, title, message, isRead: false })`
- Batch insert: `await notify(arrayOfValues)`
- Inside a Drizzle transaction (where you must use `tx.insert`): keep the raw `tx.insert(notificationsTable)` for DB atomicity, then call `sendPushToUsers(entries)` **after** the transaction returns (fire-and-forget).

## Files
- `artifacts/api-server/src/lib/notify.ts` — `notify()` + `sendPushToUsers()`
- `artifacts/api-server/src/routes/push.ts` — `POST /api/push/subscribe`, `DELETE /api/push/subscribe`
- `artifacts/cotopia/public/sw.js` — service worker (handles `push` event + `notificationclick`)
- `artifacts/cotopia/src/lib/usePushNotifications.ts` — React hook: register SW, request permission, subscribe/unsubscribe
- `artifacts/cotopia/src/pages/notifications.tsx` — `PushNotificationBanner` component shown at top of page

## Transaction edge case
The broadcast endpoint (`POST /admin/broadcast`) uses a `db.transaction(tx => { tx.insert(notificationsTable)…; tx.insert(broadcastsTable)…; })` for atomicity. `sendPushToUsers()` is called after the transaction with `void` (fire-and-forget) to avoid breaking atomicity.

## DB table
`push_subscriptions` (userId FK → cascade delete, endpoint UNIQUE, p256dh, auth). Must be manually pushed to prod DB with `pnpm --filter @workspace/db run push` before deploying.

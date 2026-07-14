import webPush from "web-push";
import { db, notificationsTable, pushSubscriptionsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import type { InsertNotification } from "@workspace/db";

if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webPush.setVapidDetails(
    process.env.VAPID_SUBJECT || "mailto:support@cotopia.com",
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY,
  );
}

async function dispatchPush(userId: number, title: string, body: string): Promise<void> {
  if (!process.env.VAPID_PUBLIC_KEY) return;
  try {
    const subs = await db
      .select()
      .from(pushSubscriptionsTable)
      .where(eq(pushSubscriptionsTable.userId, userId));
    await Promise.all(
      subs.map(async (sub) => {
        try {
          await webPush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            JSON.stringify({ title, body, url: "/notifications" }),
          );
        } catch (err: unknown) {
          const status = (err as { statusCode?: number }).statusCode;
          if (status === 410 || status === 404) {
            await db
              .delete(pushSubscriptionsTable)
              .where(eq(pushSubscriptionsTable.id, sub.id));
          }
        }
      }),
    );
  } catch {
    // Push delivery is best-effort — never fail the main operation
  }
}

export async function notify(
  value: InsertNotification | InsertNotification[],
): Promise<void> {
  const values = Array.isArray(value) ? value : [value];
  if (values.length === 0) return;
  await db.insert(notificationsTable).values(values);
  await Promise.all(values.map((v) => dispatchPush(v.userId, v.title, v.message)));
}

/** Fire-and-forget push to a list of user IDs — use after a tx.insert(notificationsTable) to add push delivery without breaking atomicity. */
export function sendPushToUsers(
  entries: { userId: number; title: string; message: string }[],
): void {
  void Promise.all(entries.map((e) => dispatchPush(e.userId, e.title, e.message)));
}

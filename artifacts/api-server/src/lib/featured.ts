import { db, appSettingsTable } from "@workspace/db";

// Upper bound on how many featured items we pull into memory to rotate through.
export const FEATURED_POOL_SIZE = 50;

// How often the rotation window advances. One hour gives a visibly fresh set
// of featured content through the day without thrashing on every request.
const ROTATION_BUCKET_MS = 60 * 60 * 1000;

/**
 * Reads the app-wide feature-rotation toggle. Defaults to enabled when no
 * settings row exists yet.
 */
export async function isFeatureRotationEnabled(): Promise<boolean> {
  const [settings] = await db
    .select({ featureRotation: appSettingsTable.featureRotation })
    .from(appSettingsTable)
    .limit(1);
  return settings?.featureRotation ?? true;
}

/**
 * Returns a `limit`-sized slice of the featured `pool`.
 *
 * When rotation is OFF (or the pool is no larger than the limit), the original
 * order is preserved — i.e. the most recent featured items, exactly as before.
 *
 * When rotation is ON, the visible window advances through the pool on a stable
 * time bucket, so different featured items surface over time while the result
 * stays stable within each bucket (and is therefore cache-friendly).
 */
export function rotateFeatured<T>(pool: T[], limit: number, enabled: boolean): T[] {
  if (!enabled || pool.length <= limit) return pool.slice(0, limit);
  const bucket = Math.floor(Date.now() / ROTATION_BUCKET_MS);
  const offset = ((bucket % pool.length) + pool.length) % pool.length;
  const rotated = [...pool.slice(offset), ...pool.slice(0, offset)];
  return rotated.slice(0, limit);
}

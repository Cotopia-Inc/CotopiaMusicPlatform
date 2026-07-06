/**
 * All release-date scheduling (song/video "wait until release date" gating)
 * runs on US Eastern Time, not server/database UTC. This keeps the "does a
 * release date count as arrived yet" answer consistent no matter what
 * timezone the server or database happens to be running in.
 */
export const RELEASE_TIMEZONE = "America/New_York";

/**
 * Today's date ("YYYY-MM-DD") in the release timezone (US Eastern).
 */
export function getTodayInReleaseTimezone(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: RELEASE_TIMEZONE });
}

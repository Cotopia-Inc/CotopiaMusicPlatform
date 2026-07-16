/**
 * Shared maintenance-mode cache state.
 * Extracted to a separate module so both app.ts and admin.ts can reference it
 * without creating a circular import.
 */

let _value: boolean | null = null;
let _expiry = 0;
const TTL_MS = 30_000;

export function getMaintenanceCached(): boolean | null {
  if (Date.now() < _expiry && _value !== null) return _value;
  return null;
}

export function setMaintenanceCache(v: boolean): void {
  _value = v;
  _expiry = Date.now() + TTL_MS;
}

export function invalidateMaintenanceCache(): void {
  _expiry = 0;
}

/* The helper Mac reports in every 30 s (`helpers/{id}` in Firestore); the website reads it to know if images can be made. */
export interface HelperHeartbeat {
  helperId: string;
  hostname: string;
  lastSeen: string;
  startedAt: string;
  /** Codex is installed and signed in on the helper Mac. */
  ready: boolean;
  detail: string;
  model: string;
  busyJobId: string | null;
}

export const HEARTBEAT_MS = 30_000;
/** Missing two heartbeats in a row means the helper is offline (Mac asleep, window closed, no internet). */
export const OFFLINE_AFTER_MS = 2.5 * HEARTBEAT_MS;

export function isOnline(h: Pick<HelperHeartbeat, "lastSeen"> | null, now = Date.now()): boolean {
  return !!h && now - Date.parse(h.lastSeen) < OFFLINE_AFTER_MS;
}

/** The helper to trust: a ready, online one first, then the most recently seen. */
export function pickHelper<T extends HelperHeartbeat>(helpers: T[], now = Date.now()): T | null {
  const sorted = [...helpers].sort((a, b) => b.lastSeen.localeCompare(a.lastSeen));
  return sorted.find((h) => isOnline(h, now) && h.ready) ?? sorted.find((h) => isOnline(h, now)) ?? sorted[0] ?? null;
}

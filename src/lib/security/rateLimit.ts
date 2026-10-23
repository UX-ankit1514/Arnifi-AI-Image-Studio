import "server-only";
import { FieldValue } from "firebase-admin/firestore";
import { COLLECTIONS, getDb, hasStorage } from "@/lib/database/firestore";
import type { JobError } from "@/types/generation";
import { SlidingWindow } from "./slidingWindow";

/*
 * Usage safeguards (PRD §21.2). Each generate/edit request reserves one unit against:
 *   • a per-session hourly limit (in memory, sliding window),
 *   • a daily budget for the whole app, counted in Firestore `usage/{yyyy-mm-dd}` so it survives restarts.
 * Both are configurable. Failed requests still count — the provider may have done the work.
 */

export function usageLimits() {
  const n = (name: string, fallback: number) => {
    const v = Number(process.env[name]);
    return Number.isFinite(v) && v > 0 ? Math.floor(v) : fallback;
  };
  return {
    perDay: n("MAX_IMAGE_REQUESTS_PER_DAY", 40),
    perSessionPerHour: n("MAX_REQUESTS_PER_SESSION_PER_HOUR", 15),
    maxOutputsPerRequest: n("MAX_OUTPUTS_PER_REQUEST", 1),
  };
}

const g = globalThis as unknown as { __studioWindow?: SlidingWindow; __studioDaily?: Map<string, number> };
const sessions = (g.__studioWindow ??= new SlidingWindow(60 * 60_000));
const memoryDaily = (g.__studioDaily ??= new Map<string, number>());

export function today(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export async function usageToday(): Promise<{ date: string; used: number; limit: number }> {
  const date = today();
  const limit = usageLimits().perDay;
  if (!hasStorage()) return { date, used: memoryDaily.get(date) ?? 0, limit };
  try {
    const snap = await getDb().collection(COLLECTIONS.usage).doc(date).get();
    return { date, used: (snap.get("requests") as number | undefined) ?? 0, limit };
  } catch {
    return { date, used: memoryDaily.get(date) ?? 0, limit };
  }
}

/**
 * `sessionHits` (helper mode): the session's request times in the last hour, counted from Firestore — on Vercel each
 * request can land on a different server, so an in-memory count would be wrong.
 */
export async function reserveRequest(sessionId: string, kind: "generate" | "edit", sessionHits?: number[]): Promise<JobError | null> {
  const limits = usageLimits();
  const now = Date.now();
  const hits = sessionHits ?? null;
  const used = hits ? hits.filter((t) => now - t < 60 * 60_000).length : sessions.count(sessionId, now);
  if (used >= limits.perSessionPerHour) {
    const oldest = hits ? Math.min(...hits) : sessions.oldest(sessionId, now)!;
    const resetAt = new Date(oldest + 60 * 60_000).toISOString();
    return { code: "rate_limited", message: `You’ve made ${limits.perSessionPerHour} image requests in the last hour. Take a short break and try again.`, retryable: true, resetAt };
  }
  const date = today();
  const overBudget: JobError = {
    code: "budget_reached",
    message: `Today’s limit of ${limits.perDay} image requests for the studio has been reached. It resets at midnight (UTC).`,
    retryable: false,
    resetAt: new Date(`${date}T23:59:59.999Z`).toISOString(),
  };
  if (hasStorage()) {
    try {
      const db = getDb();
      const ref = db.collection(COLLECTIONS.usage).doc(date);
      const ok = await db.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        const used = (snap.get("requests") as number | undefined) ?? 0;
        if (used >= limits.perDay) return false;
        tx.set(ref, { requests: FieldValue.increment(1), [kind]: FieldValue.increment(1), updatedAt: new Date().toISOString() }, { merge: true });
        return true;
      });
      if (!ok) return overBudget;
    } catch {
      if (!reserveInMemory(date, limits.perDay)) return overBudget;
    }
  } else if (!reserveInMemory(date, limits.perDay)) {
    return overBudget;
  }
  sessions.hit(sessionId, now);
  return null;
}

function reserveInMemory(date: string, limit: number): boolean {
  const used = memoryDaily.get(date) ?? 0;
  if (used >= limit) return false;
  memoryDaily.set(date, used + 1);
  return true;
}

/** Tests only. */
export function resetUsage() {
  sessions.clear();
  memoryDaily.clear();
}

import "server-only";
import type { Job } from "@/types/generation";
import { COLLECTIONS, getDb, hasStorage } from "./firestore";

/*
 * Image jobs (PRD §18.1 "Image Jobs"). The runner keeps live jobs in memory — polling never costs Firestore reads —
 * and writes each state change here, so job history and outcomes survive a restart.
 */

export async function persistJob(job: Job): Promise<void> {
  if (!hasStorage()) return;
  try {
    await getDb().collection(COLLECTIONS.jobs).doc(job.id).set(job);
  } catch (e) {
    console.warn(`[jobs] could not record job ${job.id}: ${e instanceof Error ? e.message : e}`);
  }
}

export async function loadJob(id: string): Promise<Job | null> {
  if (!hasStorage()) return null;
  try {
    const snap = await getDb().collection(COLLECTIONS.jobs).doc(id).get();
    return snap.exists ? (snap.data() as Job) : null;
  } catch {
    return null;
  }
}

/** After a restart, jobs that were mid-flight can't finish: mark them so people see "interrupted — try again". */
export async function markInterruptedJobs(): Promise<number> {
  if (!hasStorage()) return 0;
  try {
    const snap = await getDb().collection(COLLECTIONS.jobs).where("status", "in", ["validating", "queued", "generating"]).get();
    const now = new Date().toISOString();
    await Promise.all(
      snap.docs.map((d) =>
        d.ref.update({
          status: "failed",
          finishedAt: now,
          error: { code: "interrupted", message: "The app restarted before this image was finished. Try again.", retryable: true, resetAt: null },
        }),
      ),
    );
    return snap.size;
  } catch {
    return 0;
  }
}

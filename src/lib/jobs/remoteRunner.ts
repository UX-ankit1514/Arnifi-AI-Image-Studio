import "server-only";
import { after } from "next/server";
import { getProvider } from "@/lib/ai";
import { COLLECTIONS, getDb } from "@/lib/database/firestore";
import { newId } from "@/lib/ids";
import { reserveRequest } from "@/lib/security/rateLimit";
import type { Job, JobKind, JobRequest, JobView } from "@/types/generation";
import { executeJob } from "./execute";
import type { SubmitResult } from "./runner";

/*
 * The live site's job queue (Vercel). Same promises as the Mac runner — one active request per browser, duplicate
 * submits return the same job, honest states — but jobs live in Firestore, because each request may reach a different
 * server. The server that receives a request makes the image right after answering (Next `after()`, kept alive by
 * Vercel up to the route's maxDuration), and any server can report its progress.
 */

const IDEMPOTENCY_WINDOW_MS = 10 * 60_000;
/** Longer than a server may run (maxDuration 300 s): a request still "generating" after this was cut off. */
const STALE_MS = 6 * 60_000;
/** A request nobody picked up after this long (its server stopped early) is picked up by whoever reads it next. */
const UNCLAIMED_MS = 20_000;
const CANCEL_POLL_MS = 3_000;

/** Runs work after the response is sent; outside a request (scripts, tests) it simply starts it. */
export function runAfter(task: () => Promise<unknown>) {
  const safe = () => task().catch((e) => console.error("[jobs] background work failed:", e));
  try {
    after(safe);
  } catch {
    void safe();
  }
}

export class RemoteRunner {
  private jobs() {
    return getDb().collection(COLLECTIONS.jobs);
  }

  async submit(kind: JobKind, request: JobRequest, sessionId: string, idempotencyKey: string | null): Promise<SubmitResult> {
    const since = new Date(Date.now() - 60 * 60_000).toISOString();
    const recent = (await this.jobs().where("sessionId", "==", sessionId).where("createdAt", ">=", since).get()).docs.map((d) => d.data() as Job);

    if (idempotencyKey) {
      const same = recent.find((j) => j.idempotencyKey === idempotencyKey && Date.now() - Date.parse(j.createdAt) < IDEMPOTENCY_WINDOW_MS);
      if (same) return { ok: true, job: same, reused: true };
    }
    if (recent.some((j) => (j.status === "queued" || j.status === "generating") && Date.now() - Date.parse(j.createdAt) < STALE_MS)) {
      return { ok: false, status: 409, error: { code: "rate_limited", message: "An image is already being made. Wait for it to finish, or cancel it first.", retryable: true, resetAt: null } };
    }

    const provider = getProvider();
    const status = await provider.status();
    if (!status.ready) {
      return { ok: false, status: 503, error: { code: "not_configured", message: `${status.detail} See Settings for how to fix it.`, retryable: false, resetAt: null } };
    }

    const limited = await reserveRequest(sessionId, kind, recent.map((j) => Date.parse(j.createdAt)));
    if (limited) return { ok: false, status: 429, error: limited };

    const job: Job = {
      id: newId("job"),
      kind,
      status: "queued",
      sessionId,
      idempotencyKey,
      request,
      provider: provider.id,
      model: provider.model(kind),
      error: null,
      output: null,
      warnings: [],
      createdAt: new Date().toISOString(),
      startedAt: null,
      finishedAt: null,
      savedImageId: null,
      cancelRequested: false,
    };
    await this.jobs().doc(job.id).create(job);
    runAfter(() => this.process(job.id));
    return { ok: true, job, reused: false };
  }

  /** Claims a queued job (only one server can) and makes its image. */
  async process(id: string): Promise<void> {
    const ref = this.jobs().doc(id);
    const job = await getDb().runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const current = snap.data() as Job | undefined;
      if (!current || current.status !== "queued") return null;
      const next: Job = { ...current, status: "generating", startedAt: new Date().toISOString() };
      tx.set(ref, next);
      return next;
    });
    if (!job) return;

    // Cancel may arrive at any server: watch the job document and stop the request if it's flagged.
    const controller = new AbortController();
    let cancelled = false;
    const watch = setInterval(async () => {
      const flagged = await ref.get().then((s) => s.get("cancelRequested") === true).catch(() => false);
      if (flagged) {
        cancelled = true;
        controller.abort();
      }
    }, CANCEL_POLL_MS);
    try {
      const done = await executeJob(job, getProvider(), controller.signal, () => cancelled);
      await ref.set({ ...done, cancelRequested: false });
    } finally {
      clearInterval(watch);
    }
  }

  async get(id: string): Promise<JobView | null> {
    const snap = await this.jobs().doc(id).get();
    if (!snap.exists) return null;
    const job = snap.data() as Job;

    if (job.status === "generating" && job.startedAt && Date.now() - Date.parse(job.startedAt) > STALE_MS) {
      const failed: Job = { ...job, status: "failed", finishedAt: new Date().toISOString(), error: { code: "interrupted", message: "This image took too long and was stopped. Try again.", retryable: true, resetAt: null } };
      await snap.ref.set(failed);
      return { ...failed, queuePosition: null };
    }
    if (job.status === "queued" && Date.now() - Date.parse(job.createdAt) > UNCLAIMED_MS) {
      runAfter(() => this.process(id)); // self-healing: the claim makes sure only one server does it
    }
    return { ...job, queuePosition: null };
  }

  /** Queued: cancelled at once, nothing is sent. Running: the server making it is told to stop. */
  async cancel(id: string, sessionId: string): Promise<Job | null> {
    const ref = this.jobs().doc(id);
    return getDb().runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) return null;
      const job = snap.data() as Job;
      if (job.sessionId !== sessionId) return null;
      if (job.status === "queued") {
        const next = { ...job, status: "cancelled" as const, finishedAt: new Date().toISOString() };
        tx.set(ref, next);
        return next;
      }
      if (job.status === "generating") {
        tx.update(ref, { cancelRequested: true });
        return { ...job, cancelRequested: true };
      }
      return job;
    });
  }

  markSaved(jobId: string, imageId: string) {
    void this.jobs().doc(jobId).update({ savedImageId: imageId }).catch(() => {});
  }
}

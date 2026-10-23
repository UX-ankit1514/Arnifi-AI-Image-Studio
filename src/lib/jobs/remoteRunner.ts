import "server-only";
import { getProvider } from "@/lib/ai";
import { HelperProvider } from "@/lib/ai/helperProvider";
import { COLLECTIONS, getDb } from "@/lib/database/firestore";
import { isOnline } from "@/lib/helper/heartbeat";
import { newId } from "@/lib/ids";
import { reserveRequest } from "@/lib/security/rateLimit";
import type { Job, JobKind, JobRequest, JobView } from "@/types/generation";
import type { SubmitResult } from "./runner";

/*
 * The live site's job queue (helper mode). Same promises as the local runner — one active request per browser,
 * duplicate submits return the same job, honest states — but the jobs live in Firestore, because on Vercel every
 * request may reach a different server and the images are made by the helper Mac, which watches this queue.
 */

const IDEMPOTENCY_WINDOW_MS = 10 * 60_000;
/** A request still "generating" this long after it started, with no helper working on it, was cut off. */
const STALE_MS = 20 * 60_000;

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
    if (recent.some((j) => j.status === "queued" || j.status === "generating")) {
      return { ok: false, status: 409, error: { code: "rate_limited", message: "An image is already being made. Wait for it to finish, or cancel it first.", retryable: true, resetAt: null } };
    }

    const provider = getProvider();
    const status = await provider.status(true);
    if (!status.ready) {
      return { ok: false, status: 503, error: { code: "not_configured", message: `${status.detail} See Settings for how to start it.`, retryable: false, resetAt: null } };
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
      helperId: null,
      cancelRequested: false,
    };
    await this.jobs().doc(job.id).create(job);
    return { ok: true, job, reused: false };
  }

  async get(id: string): Promise<JobView | null> {
    const snap = await this.jobs().doc(id).get();
    if (!snap.exists) return null;
    const job = snap.data() as Job;
    if (job.status !== "queued" && job.status !== "generating") return { ...job, queuePosition: null };

    const provider = getProvider();
    const helper = provider instanceof HelperProvider ? await provider.helper() : null;
    const online = isOnline(helper);

    if (job.status === "generating") {
      const stale = job.startedAt && Date.now() - Date.parse(job.startedAt) > STALE_MS && (!online || helper?.busyJobId !== job.id);
      if (stale) {
        const failed: Job = { ...job, status: "failed", finishedAt: new Date().toISOString(), error: { code: "interrupted", message: "The helper Mac stopped before this image was finished. Try again.", retryable: true, resetAt: null } };
        await snap.ref.set(failed);
        return { ...failed, queuePosition: null };
      }
      return { ...job, queuePosition: null, note: online ? null : "The helper Mac has gone offline. The image continues if it comes back soon." };
    }

    const queued = (await this.jobs().where("status", "==", "queued").get()).docs.map((d) => d.data() as Job).filter((j) => j.createdAt < job.createdAt);
    return {
      ...job,
      queuePosition: queued.length + (helper?.busyJobId ? 1 : 0),
      note: online ? null : "Waiting for the helper Mac — it’s offline right now. This starts as soon as it’s back, or you can cancel.",
    };
  }

  /** Queued: cancelled at once, nothing is sent. Running: the helper is told to stop. */
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

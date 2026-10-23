import "server-only";
import type { Firestore } from "firebase-admin/firestore";
import { handleProviderError, ProviderError, type ImageProvider } from "@/lib/ai/imageProvider";
import { normalizeImageResult } from "@/lib/ai/normalize";
import { COLLECTIONS } from "@/lib/database/firestore";
import { loadSource } from "@/lib/jobs/runner";
import { putDraft } from "@/lib/storage/draftStore";
import type { Job } from "@/types/generation";
import { HEARTBEAT_MS, type HelperHeartbeat } from "./heartbeat";

/*
 * The helper Mac's worker (`npm run helper`). It watches the live site's queue in Firestore, claims one request at a
 * time, makes the image with Codex on this Mac (the ChatGPT plan it's signed in with), stores the result in Firestore
 * and marks the request done. It reports in every 30 s so the website can say whether images can be made.
 *
 * Firestore costs stay small: a live listener (only changes are read) instead of polling, and one heartbeat write
 * every 30 s.
 */

export interface WorkerOptions {
  helperId: string;
  hostname: string;
  heartbeatMs?: number;
  log?: (message: string) => void;
}

export class HelperWorker {
  private busy: string | null = null;
  private queued = new Set<string>();
  private stopQueue: (() => void) | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private stopped = false;
  private readonly startedAt = new Date().toISOString();
  private readonly log: (message: string) => void;

  constructor(
    private readonly db: Firestore,
    private readonly provider: ImageProvider,
    private readonly opts: WorkerOptions,
  ) {
    this.log = opts.log ?? (() => {});
  }

  async start(): Promise<void> {
    await this.recover();
    await this.heartbeat();
    this.timer = setInterval(() => void this.heartbeat(), this.opts.heartbeatMs ?? HEARTBEAT_MS);
    this.listen();
  }

  async stop(): Promise<void> {
    this.stopped = true;
    this.stopQueue?.();
    if (this.timer) clearInterval(this.timer);
    // Tell the website straight away instead of waiting for the heartbeat to go stale.
    await this.db.collection(COLLECTIONS.helpers).doc(this.opts.helperId).set({ lastSeen: new Date(0).toISOString(), busyJobId: null }, { merge: true }).catch(() => {});
  }

  /** Requests this helper was making when it last stopped can't finish: mark them so people can retry. */
  private async recover() {
    const snap = await this.db.collection(COLLECTIONS.jobs).where("helperId", "==", this.opts.helperId).where("status", "==", "generating").get();
    for (const doc of snap.docs) {
      await doc.ref.update({
        status: "failed",
        finishedAt: new Date().toISOString(),
        error: { code: "interrupted", message: "The helper Mac restarted before this image was finished. Try again.", retryable: true, resetAt: null },
      });
    }
    if (snap.size) this.log(`Marked ${snap.size} unfinished request(s) from before the restart as interrupted.`);
  }

  async heartbeat(): Promise<void> {
    if (this.stopped) return;
    const status = await this.provider.status().catch(() => null);
    const beat: HelperHeartbeat = {
      helperId: this.opts.helperId,
      hostname: this.opts.hostname,
      lastSeen: new Date().toISOString(),
      startedAt: this.startedAt,
      ready: status?.ready ?? false,
      detail: status?.detail ?? "Couldn’t check Codex on this Mac.",
      model: this.provider.model("generate"),
      busyJobId: this.busy,
    };
    try {
      await this.db.collection(COLLECTIONS.helpers).doc(this.opts.helperId).set(beat);
    } catch (e) {
      this.log(`Couldn’t report in to the website (${e instanceof Error ? e.message : e}). Retrying in 30 s.`);
    }
  }

  private listen() {
    if (this.stopped) return;
    this.stopQueue = this.db
      .collection(COLLECTIONS.jobs)
      .where("status", "==", "queued")
      .onSnapshot(
        (snap) => {
          const jobs = snap.docs.map((d) => d.data() as Job).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
          this.queued = new Set(jobs.map((j) => j.id));
          void this.pump(jobs.map((j) => j.id));
        },
        (err) => {
          this.log(`Lost the connection to the queue (${err.message}). Reconnecting in 10 s…`);
          this.stopQueue = null;
          setTimeout(() => this.listen(), 10_000);
        },
      );
  }

  private async pump(ids: string[]): Promise<void> {
    if (this.busy || this.stopped) return;
    for (const id of ids) {
      if (!this.queued.has(id)) continue;
      const job = await this.claim(id);
      if (!job) continue;
      this.busy = job.id;
      void this.heartbeat();
      try {
        await this.execute(job);
      } finally {
        this.busy = null;
        void this.heartbeat();
      }
      return this.pump([...this.queued]);
    }
  }

  /** Takes a queued request for this helper; another helper (or a Cancel) may have got there first. */
  private async claim(id: string): Promise<Job | null> {
    const ref = this.db.collection(COLLECTIONS.jobs).doc(id);
    return this.db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const job = snap.data() as Job | undefined;
      if (!job || job.status !== "queued") return null;
      const next: Job = { ...job, status: "generating", startedAt: new Date().toISOString(), helperId: this.opts.helperId };
      tx.set(ref, next);
      return next;
    });
  }

  async execute(job: Job): Promise<Job> {
    const ref = this.db.collection(COLLECTIONS.jobs).doc(job.id);
    const controller = new AbortController();
    const stopWatch = ref.onSnapshot((s) => {
      if (s.get("cancelRequested") === true) controller.abort();
    });
    const what = job.kind === "generate" ? `“${(job.request.brief ?? "").slice(0, 60)}”` : `edit: “${(job.request.instruction ?? "").slice(0, 60)}”`;
    this.log(`Making image ${what}…`);
    const started = Date.now();
    let finished: Job;
    try {
      if (job.kind === "generate") {
        const raw = await this.provider.generateImage({ prompt: job.request.composedPrompt, options: job.request.options }, controller.signal);
        const image = await normalizeImageResult(raw, { aspect: job.request.options.aspect });
        const draft = await putDraft(image.bytes, image, { origin: "generate", jobId: job.id });
        finished = { ...job, status: "completed", output: draft, warnings: image.warnings, finishedAt: new Date().toISOString() };
      } else {
        const source = await loadSource(job.request.source!).catch((e: unknown) => {
          throw new ProviderError("invalid_request", "The original image couldn’t be opened, so nothing was sent. Choose the image again.", { retryable: false, detail: String(e) });
        });
        const raw = await this.provider.editImage({ prompt: job.request.composedPrompt, image: source }, controller.signal);
        const image = await normalizeImageResult(raw, { source });
        const draft = await putDraft(image.bytes, image, { origin: "edit", jobId: job.id, parent: job.request.source, instruction: job.request.instruction });
        finished = { ...job, status: "completed", output: draft, warnings: image.warnings, finishedAt: new Date().toISOString() };
      }
      this.log(`  ✓ Done in ${Math.round((Date.now() - started) / 1000)} s.`);
    } catch (e) {
      if (controller.signal.aborted) {
        finished = { ...job, status: "cancelled", finishedAt: new Date().toISOString() };
        this.log("  ■ Cancelled from the website.");
      } else {
        const err = e instanceof ProviderError ? e : handleProviderError(e);
        finished = { ...job, status: "failed", finishedAt: new Date().toISOString(), error: { code: err.code, message: err.message, retryable: err.retryable, resetAt: err.resetAt } };
        this.log(`  ✖ ${err.message}${err.options.detail ? ` (${err.options.detail.slice(-200).replace(/\s+/g, " ")})` : ""}`);
      }
    } finally {
      stopWatch();
    }
    await ref.set({ ...finished, cancelRequested: false });
    return finished;
  }
}

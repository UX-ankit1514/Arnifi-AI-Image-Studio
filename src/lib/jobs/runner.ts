import "server-only";
import { getProvider } from "@/lib/ai";
import { handleProviderError, ProviderError } from "@/lib/ai/imageProvider";
import { normalizeImageResult } from "@/lib/ai/normalize";
import { getImageStore } from "@/lib/database/imageRepository";
import { loadJob, markInterruptedJobs, persistJob } from "@/lib/database/jobRepository";
import { newId } from "@/lib/ids";
import { usesRemoteJobs } from "@/lib/mode";
import { reserveRequest } from "@/lib/security/rateLimit";
import { getDraft, putDraft } from "@/lib/storage/draftStore";
import { inspectImage } from "@/lib/validation/files";
import type { Job, JobError, JobKind, JobRequest, JobView, SourceRef } from "@/types/generation";
import { RemoteRunner } from "./remoteRunner";

/*
 * The job runner (PRD §14.5, §15.2, §21.2). Requests queue here and run one at a time — ChatGPT plans throttle
 * parallel image jobs — in this server process. Each job moves queued → generating → completed | failed | cancelled,
 * and only a real, verified provider image ever becomes "completed" (PRD §14.5, §26).
 *
 * Protection against duplicate paid requests: one active job per browser session, and a resubmitted idempotency key
 * returns the job it already started.
 */

const IDEMPOTENCY_WINDOW_MS = 10 * 60_000;
const KEEP_FINISHED_MS = 6 * 60 * 60_000;

export type SubmitResult = { ok: true; job: Job; reused: boolean } | { ok: false; status: number; error: JobError };

export class JobRunner {
  private jobs = new Map<string, Job>();
  private queue: string[] = [];
  private running: string | null = null;
  private controllers = new Map<string, AbortController>();
  private cancelRequested = new Set<string>();
  private recovery: Promise<void> | null = null;

  private recover(): Promise<void> {
    this.recovery ??= markInterruptedJobs().then((n) => {
      if (n) console.info(`[jobs] marked ${n} unfinished job(s) from before the restart as interrupted`);
    });
    return this.recovery;
  }

  activeFor(sessionId: string): Job | null {
    for (const job of this.jobs.values()) if (job.sessionId === sessionId && (job.status === "queued" || job.status === "generating")) return job;
    return null;
  }

  async submit(kind: JobKind, request: JobRequest, sessionId: string, idempotencyKey: string | null): Promise<SubmitResult> {
    await this.recover();
    this.prune();

    if (idempotencyKey) {
      for (const job of this.jobs.values()) {
        if (job.sessionId === sessionId && job.idempotencyKey === idempotencyKey && Date.now() - Date.parse(job.createdAt) < IDEMPOTENCY_WINDOW_MS) {
          return { ok: true, job: structuredClone(job), reused: true };
        }
      }
    }

    const active = this.activeFor(sessionId);
    if (active) {
      return {
        ok: false,
        status: 409,
        error: { code: "rate_limited", message: "An image is already being made. Wait for it to finish, or cancel it first.", retryable: true, resetAt: null },
      };
    }

    const provider = getProvider();
    const status = await provider.status();
    if (!status.ready) {
      return {
        ok: false,
        status: 503,
        error: { code: /sign/i.test(status.detail) ? "not_signed_in" : "not_configured", message: `${status.detail} See Settings to connect it.`, retryable: false, resetAt: null },
      };
    }

    const limited = await reserveRequest(sessionId, kind);
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
    };
    this.jobs.set(job.id, job);
    this.queue.push(job.id);
    void persistJob(job);
    // Answer with a snapshot: the live job starts changing as soon as the queue picks it up.
    const snapshot = structuredClone(job);
    void this.pump();
    return { ok: true, job: snapshot, reused: false };
  }

  async get(id: string): Promise<JobView | null> {
    const live = this.jobs.get(id);
    const job = live ?? (await loadJob(id));
    if (!job) return null;
    const index = this.queue.indexOf(id);
    return { ...job, queuePosition: index >= 0 ? index + (this.running ? 1 : 0) : null };
  }

  /** Cancelling before it starts sends nothing to the provider; cancelling while running stops the request. */
  cancel(id: string, sessionId: string): Job | null {
    const job = this.jobs.get(id);
    if (!job || job.sessionId !== sessionId) return null;
    if (job.status === "queued") {
      this.queue = this.queue.filter((q) => q !== id);
      this.finish(job, { status: "cancelled" });
    } else if (job.status === "generating") {
      this.cancelRequested.add(id);
      this.controllers.get(id)?.abort();
    }
    return job;
  }

  markSaved(jobId: string, imageId: string) {
    const job = this.jobs.get(jobId);
    if (!job) return;
    job.savedImageId = imageId;
    void persistJob(job);
  }

  private finish(job: Job, patch: Partial<Job>) {
    Object.assign(job, patch, { finishedAt: new Date().toISOString() });
    void persistJob(job);
  }

  private prune() {
    const now = Date.now();
    for (const [id, job] of this.jobs) {
      if (job.finishedAt && now - Date.parse(job.finishedAt) > KEEP_FINISHED_MS) this.jobs.delete(id);
    }
  }

  private async pump(): Promise<void> {
    if (this.running) return;
    const next = this.queue.shift();
    if (!next) return;
    const job = this.jobs.get(next);
    if (!job || job.status !== "queued") return this.pump();
    this.running = job.id;
    try {
      await this.execute(job);
    } finally {
      this.running = null;
      this.controllers.delete(job.id);
      this.cancelRequested.delete(job.id);
      void this.pump();
    }
  }

  private async execute(job: Job): Promise<void> {
    const controller = new AbortController();
    this.controllers.set(job.id, controller);
    Object.assign(job, { status: "generating", startedAt: new Date().toISOString() });
    void persistJob(job);
    const provider = getProvider();
    try {
      if (job.kind === "generate") {
        const raw = await provider.generateImage({ prompt: job.request.composedPrompt, options: job.request.options }, controller.signal);
        const image = await normalizeImageResult(raw, { aspect: job.request.options.aspect });
        const draft = await putDraft(image.bytes, image, { origin: "generate", jobId: job.id });
        this.finish(job, { status: "completed", output: draft, warnings: image.warnings });
      } else {
        const source = await loadSource(job.request.source!).catch((e: unknown) => {
          throw new ProviderError("invalid_request", "The original image couldn’t be opened, so nothing was sent. Choose the image again.", { retryable: false, detail: String(e) });
        });
        const raw = await provider.editImage({ prompt: job.request.composedPrompt, image: source }, controller.signal);
        const image = await normalizeImageResult(raw, { source });
        const draft = await putDraft(image.bytes, image, { origin: "edit", jobId: job.id, parent: job.request.source, instruction: job.request.instruction });
        this.finish(job, { status: "completed", output: draft, warnings: image.warnings });
      }
    } catch (e) {
      if (this.cancelRequested.has(job.id)) {
        this.finish(job, { status: "cancelled" });
        return;
      }
      const err = e instanceof ProviderError ? e : handleProviderError(e);
      if (err.options.detail) console.warn(`[jobs] ${job.id} failed (${err.code}): ${err.options.detail}`);
      this.finish(job, { status: "failed", error: { code: err.code, message: err.message, retryable: err.retryable, resetAt: err.resetAt } });
    }
  }
}

/** The picture an edit starts from — a library image or an unsaved draft. Never modified. */
export async function loadSource(ref: SourceRef) {
  if (ref.kind === "image") {
    const { record, bytes } = await getImageStore().getFile(ref.id);
    return { bytes, format: record.format, width: record.width, height: record.height };
  }
  const { bytes } = await getDraft(ref.id);
  const info = await inspectImage(bytes, { maxBytes: 40 * 1024 * 1024 });
  return { bytes, format: info.format, width: info.width, height: info.height };
}

/** What the API routes need from a job queue — the local runner and the live site's remote queue both provide it. */
export interface JobQueue {
  submit(kind: JobKind, request: JobRequest, sessionId: string, idempotencyKey: string | null): Promise<SubmitResult>;
  get(id: string): Promise<JobView | null>;
  cancel(id: string, sessionId: string): Job | null | Promise<Job | null>;
  markSaved(jobId: string, imageId: string): void;
}

const g = globalThis as unknown as { __jobRunner?: JobQueue; __jobRunnerKind?: string };

export function getRunner(): JobQueue {
  const kind = usesRemoteJobs() ? "remote" : "local";
  if (!g.__jobRunner || g.__jobRunnerKind !== kind) {
    g.__jobRunner = kind === "remote" ? new RemoteRunner() : new JobRunner();
    g.__jobRunnerKind = kind;
  }
  return g.__jobRunner;
}

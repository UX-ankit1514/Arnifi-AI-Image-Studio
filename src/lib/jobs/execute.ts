import "server-only";
import { handleProviderError, ProviderError, type ImageProvider } from "@/lib/ai/imageProvider";
import { normalizeImageResult } from "@/lib/ai/normalize";
import { getImageStore } from "@/lib/database/imageRepository";
import { getDraft, putDraft } from "@/lib/storage/draftStore";
import { inspectImage } from "@/lib/validation/files";
import type { Job, SourceRef } from "@/types/generation";

/*
 * Makes one image for a job — shared by the Mac runner and the live site's Firestore queue. Only a real, verified
 * provider image becomes "completed" (PRD §14.5, §26); everything else ends as an honest failure.
 */

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

export async function executeJob(job: Job, provider: ImageProvider, signal: AbortSignal, cancelled: () => boolean = () => signal.aborted): Promise<Job> {
  const finished = (patch: Partial<Job>): Job => ({ ...job, ...patch, finishedAt: new Date().toISOString() });
  try {
    if (job.kind === "generate") {
      const raw = await provider.generateImage({ prompt: job.request.composedPrompt, options: job.request.options }, signal);
      const image = await normalizeImageResult(raw, { aspect: job.request.options.aspect });
      const draft = await putDraft(image.bytes, image, { origin: "generate", jobId: job.id });
      return finished({ status: "completed", output: draft, warnings: image.warnings });
    }
    const source = await loadSource(job.request.source!).catch((e: unknown) => {
      throw new ProviderError("invalid_request", "The original image couldn’t be opened, so nothing was sent. Choose the image again.", { retryable: false, detail: String(e) });
    });
    const raw = await provider.editImage({ prompt: job.request.composedPrompt, image: source }, signal);
    const image = await normalizeImageResult(raw, { source });
    const draft = await putDraft(image.bytes, image, { origin: "edit", jobId: job.id, parent: job.request.source, instruction: job.request.instruction });
    return finished({ status: "completed", output: draft, warnings: image.warnings });
  } catch (e) {
    if (cancelled()) return finished({ status: "cancelled" });
    const err = e instanceof ProviderError ? e : handleProviderError(e);
    if (err.options.detail) console.warn(`[jobs] ${job.id} failed (${err.code}): ${err.options.detail}`);
    return finished({ status: "failed", error: { code: err.code, message: err.message, retryable: err.retryable, resetAt: err.resetAt } });
  }
}

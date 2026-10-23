import "server-only";
import { EDIT_TEMPLATE_BY_MODE } from "@/data/promptTemplates";
import { getImageStore, ImageNotFoundError, type NewImage } from "@/lib/database/imageRepository";
import { getRunner } from "@/lib/jobs/runner";
import { describeEditChain, familyOf, nextVersion } from "@/lib/images/versions";
import { getDraft, markDraftSaved, putDraft } from "@/lib/storage/draftStore";
import { inspectImage } from "@/lib/validation/files";
import type { ImageMetaInput } from "@/lib/validation/schemas";
import type { DraftInfo, Job } from "@/types/generation";
import type { ImageRecord } from "@/types/image";

/*
 * Putting images into the library (PRD §8.2 step 8, §9.2 step 7, §13.2, FR-07):
 *   • uploads become version 1 of a new family,
 *   • a generated draft is saved with its brief, guideline, provider and model,
 *   • an edited draft becomes a new version linked to its parent — the source is never overwritten. If the source was
 *     itself unsaved (an upload or a fresh generation), it is saved first so the original stays recoverable.
 * Saving the same draft twice returns the image saved the first time.
 */

function blankMeta(meta: ImageMetaInput) {
  return {
    title: meta.title,
    category: meta.category,
    tags: meta.tags,
    notes: meta.notes ?? null,
    campaign: meta.campaign ?? null,
    usageContext: meta.usageContext ?? null,
    owner: meta.owner ?? null,
    attribution: meta.attribution ?? null,
  };
}

const NO_AI = { prompt: null, finalPrompt: null, promptTemplateId: null, promptTemplateTitle: null, provider: null, model: null } as const;

export async function uploadToLibrary(bytes: Buffer, meta: ImageMetaInput, extra: Partial<NewImage> = {}): Promise<ImageRecord> {
  const info = await inspectImage(bytes);
  const input: NewImage = { ...blankMeta(meta), ...NO_AI, sourceType: "uploaded", parentImageId: null, rootImageId: null, version: 1, seeded: false, ...extra };
  return getImageStore().create(input, bytes, info);
}

/** Editor uploads stay unsaved until an edit is saved (then the original is saved alongside it). */
export async function uploadDraft(bytes: Buffer, originalName: string | null): Promise<DraftInfo> {
  const info = await inspectImage(bytes);
  return putDraft(bytes, info, { origin: "upload", originalName });
}

async function existingSave(draft: DraftInfo): Promise<ImageRecord | null> {
  if (!draft.savedImageId) return null;
  return getImageStore().get(draft.savedImageId);
}

async function jobFor(draft: DraftInfo): Promise<Job | null> {
  return draft.jobId ? getRunner().get(draft.jobId) : null;
}

export async function saveDraftToLibrary(draftId: string, meta: ImageMetaInput): Promise<ImageRecord> {
  const { info: draft, bytes } = await getDraft(draftId);
  const already = await existingSave(draft);
  if (already) return already;

  const store = getImageStore();
  const image = await inspectImage(bytes, { maxBytes: 40 * 1024 * 1024 });
  const job = await jobFor(draft);
  let record: ImageRecord;

  if (draft.origin === "upload") {
    record = await store.create({ ...blankMeta(meta), ...NO_AI, sourceType: "uploaded", parentImageId: null, rootImageId: null, version: 1, seeded: false }, bytes, image);
  } else if (draft.origin === "generate") {
    record = await store.create(
      {
        ...blankMeta(meta),
        sourceType: "generated",
        prompt: job?.request.brief ?? null,
        finalPrompt: job?.request.composedPrompt ?? null,
        promptTemplateId: job?.request.templateId ?? null,
        promptTemplateTitle: job?.request.templateTitle ?? null,
        provider: job?.provider ?? null,
        model: job?.model ?? null,
        parentImageId: null,
        rootImageId: null,
        version: 1,
        seeded: false,
      },
      bytes,
      image,
    );
  } else {
    const { parent, instructions } = await resolveEditParent(draft, meta);
    const family = familyOf(await store.list(), parent.rootImageId);
    record = await store.create(
      {
        ...blankMeta(meta),
        sourceType: "edited",
        prompt: describeEditChain(instructions),
        finalPrompt: job?.request.composedPrompt ?? null,
        promptTemplateId: job?.request.templateId ?? EDIT_TEMPLATE_BY_MODE.general,
        promptTemplateTitle: job?.request.templateTitle ?? null,
        provider: job?.provider ?? null,
        model: job?.model ?? null,
        parentImageId: parent.id,
        rootImageId: parent.rootImageId,
        version: nextVersion(family.length ? family : [parent]),
        seeded: false,
      },
      bytes,
      image,
    );
  }

  await markDraftSaved(draftId, record.id);
  if (draft.jobId) getRunner().markSaved(draft.jobId, record.id);
  return record;
}

/**
 * Walks back from an edit to the nearest saved image. Unsaved intermediate edits contribute their instructions
 * ("Edit 1 → Edit 2"); an unsaved upload or generation at the start is saved first, as the original.
 */
async function resolveEditParent(draft: DraftInfo, meta: ImageMetaInput): Promise<{ parent: ImageRecord; instructions: string[] }> {
  const store = getImageStore();
  const instructions = [draft.instruction ?? "Edited"];
  let ref = draft.parent;
  for (let depth = 0; ref && depth < 50; depth++) {
    if (ref.kind === "image") {
      const parent = await store.get(ref.id);
      if (!parent) throw new ImageNotFoundError();
      return { parent, instructions };
    }
    const { info: prev } = await getDraft(ref.id);
    const saved = await existingSave(prev);
    if (saved) return { parent: saved, instructions };
    if (prev.origin === "edit") {
      instructions.unshift(prev.instruction ?? "Edited");
      ref = prev.parent;
      continue;
    }
    // The chain started from an unsaved upload or generation: keep that original in the library too.
    const original = await saveDraftToLibrary(prev.id, { ...meta, title: `${meta.title} (original)`.slice(0, 120) });
    return { parent: original, instructions };
  }
  throw new Error("The edit history for this image is incomplete.");
}

import "server-only";
import { mkdir, readdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { isValidId, newId } from "@/lib/ids";
import type { InspectedImage } from "@/lib/validation/files";
import type { DraftInfo, SourceRef } from "@/types/generation";

/*
 * Unsaved images — provider results and editor uploads — kept on this computer until someone saves them to the library
 * (PRD §22: if saving fails, the result stays available). Files older than 24 hours are removed, so uploads aren't kept
 * longer than needed (PRD §21.4). The folder is git-ignored.
 */

const MAX_AGE_MS = 24 * 60 * 60_000;
const EXT = { png: "png", jpeg: "jpg", webp: "webp" } as const;

function dir(): string {
  // Runtime-only paths: tell the bundler not to trace the project folder through them.
  return process.env.STUDIO_DATA_DIR ? join(/*turbopackIgnore: true*/ process.env.STUDIO_DATA_DIR, "drafts") : join(/*turbopackIgnore: true*/ process.cwd(), ".data", "drafts");
}

export class DraftNotFoundError extends Error {
  constructor() {
    super("This unsaved image is no longer available — unsaved results are kept for 24 hours.");
    this.name = "DraftNotFoundError";
  }
}

export interface NewDraft {
  origin: DraftInfo["origin"];
  jobId?: string | null;
  parent?: SourceRef | null;
  instruction?: string | null;
  originalName?: string | null;
}

export async function putDraft(bytes: Buffer, image: InspectedImage, meta: NewDraft): Promise<DraftInfo> {
  await mkdir(/*turbopackIgnore: true*/ dir(), { recursive: true });
  void sweepDrafts();
  const info: DraftInfo = {
    id: newId("drf"),
    origin: meta.origin,
    format: image.format,
    mimeType: image.mimeType,
    width: image.width,
    height: image.height,
    size: bytes.length,
    hasAlpha: image.hasAlpha,
    createdAt: new Date().toISOString(),
    jobId: meta.jobId ?? null,
    parent: meta.parent ?? null,
    instruction: meta.instruction ?? null,
    originalName: meta.originalName ?? null,
    savedImageId: null,
  };
  await writeFile(/*turbopackIgnore: true*/ join(/*turbopackIgnore: true*/ dir(), `${info.id}.${EXT[info.format]}`), bytes);
  await writeJson(info);
  return info;
}

async function writeJson(info: DraftInfo) {
  const path = join(/*turbopackIgnore: true*/ dir(), `${info.id}.json`);
  await writeFile(/*turbopackIgnore: true*/ `${path}.tmp`, JSON.stringify(info, null, 2));
  await rename(/*turbopackIgnore: true*/ `${path}.tmp`, path);
}

export async function getDraftInfo(id: string): Promise<DraftInfo> {
  if (!isValidId(id, "drf")) throw new DraftNotFoundError();
  try {
    return JSON.parse(await readFile(/*turbopackIgnore: true*/ join(/*turbopackIgnore: true*/ dir(), `${id}.json`), "utf8")) as DraftInfo;
  } catch {
    throw new DraftNotFoundError();
  }
}

export async function getDraft(id: string): Promise<{ info: DraftInfo; bytes: Buffer }> {
  const info = await getDraftInfo(id);
  try {
    return { info, bytes: await readFile(/*turbopackIgnore: true*/ join(/*turbopackIgnore: true*/ dir(), `${id}.${EXT[info.format]}`)) };
  } catch {
    throw new DraftNotFoundError();
  }
}

export async function markDraftSaved(id: string, imageId: string): Promise<DraftInfo> {
  const info = await getDraftInfo(id);
  const next = { ...info, savedImageId: imageId };
  await writeJson(next);
  return next;
}

let lastSweep = 0;

export async function sweepDrafts(now = Date.now()): Promise<number> {
  if (now - lastSweep < 60 * 60_000) return 0;
  lastSweep = now;
  let removed = 0;
  try {
    for (const name of await readdir(/*turbopackIgnore: true*/ dir())) {
      const path = join(/*turbopackIgnore: true*/ dir(), name);
      const s = await stat(/*turbopackIgnore: true*/ path).catch(() => null);
      if (s && now - s.mtimeMs > MAX_AGE_MS) {
        await rm(/*turbopackIgnore: true*/ path, { force: true });
        removed++;
      }
    }
  } catch {
    /* folder not created yet */
  }
  return removed;
}

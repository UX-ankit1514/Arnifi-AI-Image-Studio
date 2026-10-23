import "server-only";
import { mkdir, readdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { COLLECTIONS, getDb } from "@/lib/database/firestore";
import { isValidId, newId } from "@/lib/ids";
import { usesRemoteJobs } from "@/lib/mode";
import type { InspectedImage } from "@/lib/validation/files";
import type { DraftInfo, SourceRef } from "@/types/generation";
import { deleteBlob, MissingFileError, putBlob, readBlob } from "./blobStore";

/*
 * Unsaved images — provider results and editor uploads — kept until someone saves them to the library (PRD §22: if
 * saving fails, the result stays available). Removed after 24 hours, so uploads aren't kept longer than needed
 * (PRD §21.4).
 *   • On a Mac running everything itself: files in the git-ignored .data/drafts folder.
 *   • On the live site (helper mode): in Firestore (`drafts/{id}` + a blob), because the helper Mac writes the results
 *     and any of Vercel's servers must be able to read them.
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

async function localPut(bytes: Buffer, image: InspectedImage, meta: NewDraft): Promise<DraftInfo> {
  await mkdir(/*turbopackIgnore: true*/ dir(), { recursive: true });
  void sweepDrafts();
  const info = newDraftInfo(bytes, image, meta);
  await writeFile(/*turbopackIgnore: true*/ join(/*turbopackIgnore: true*/ dir(), `${info.id}.${EXT[info.format]}`), bytes);
  await writeJson(info);
  return info;
}

function newDraftInfo(bytes: Buffer, image: InspectedImage, meta: NewDraft): DraftInfo {
  return {
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
}

async function writeJson(info: DraftInfo) {
  const path = join(/*turbopackIgnore: true*/ dir(), `${info.id}.json`);
  await writeFile(/*turbopackIgnore: true*/ `${path}.tmp`, JSON.stringify(info, null, 2));
  await rename(/*turbopackIgnore: true*/ `${path}.tmp`, path);
}

async function localInfo(id: string): Promise<DraftInfo> {
  try {
    return JSON.parse(await readFile(/*turbopackIgnore: true*/ join(/*turbopackIgnore: true*/ dir(), `${id}.json`), "utf8")) as DraftInfo;
  } catch {
    throw new DraftNotFoundError();
  }
}

async function localGet(id: string): Promise<{ info: DraftInfo; bytes: Buffer }> {
  const info = await localInfo(id);
  try {
    return { info, bytes: await readFile(/*turbopackIgnore: true*/ join(/*turbopackIgnore: true*/ dir(), `${id}.${EXT[info.format]}`)) };
  } catch {
    throw new DraftNotFoundError();
  }
}

async function localMarkSaved(id: string, imageId: string): Promise<DraftInfo> {
  const info = await localInfo(id);
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

/* ── Firestore drafts (live site / helper mode) ─────────────────────────────────────────────────────────── */

type StoredDraft = DraftInfo & { blobId: string };

async function remotePut(bytes: Buffer, image: InspectedImage, meta: NewDraft): Promise<DraftInfo> {
  const db = getDb();
  void sweepRemoteDrafts();
  const info = newDraftInfo(bytes, image, meta);
  const blob = await putBlob(db, bytes, image.mimeType);
  await db.collection(COLLECTIONS.drafts).doc(info.id).create({ ...info, blobId: blob.id });
  return info;
}

async function remoteStored(id: string): Promise<StoredDraft> {
  const snap = await getDb().collection(COLLECTIONS.drafts).doc(id).get();
  if (!snap.exists) throw new DraftNotFoundError();
  return snap.data() as StoredDraft;
}

function publicInfo(d: StoredDraft): DraftInfo {
  const { blobId: _blobId, ...info } = d;
  void _blobId;
  return info;
}

async function remoteGet(id: string): Promise<{ info: DraftInfo; bytes: Buffer }> {
  const stored = await remoteStored(id);
  try {
    return { info: publicInfo(stored), bytes: (await readBlob(getDb(), stored.blobId)).bytes };
  } catch (e) {
    if (e instanceof MissingFileError) throw new DraftNotFoundError();
    throw e;
  }
}

async function remoteMarkSaved(id: string, imageId: string): Promise<DraftInfo> {
  const ref = getDb().collection(COLLECTIONS.drafts).doc(id);
  await ref.update({ savedImageId: imageId });
  return publicInfo(await remoteStored(id));
}

let lastRemoteSweep = 0;

/** Removes drafts older than 24 hours (a few at a time, so no single request does much work). */
export async function sweepRemoteDrafts(now = Date.now()): Promise<number> {
  if (now - lastRemoteSweep < 30 * 60_000) return 0;
  lastRemoteSweep = now;
  const db = getDb();
  try {
    const old = await db.collection(COLLECTIONS.drafts).where("createdAt", "<", new Date(now - MAX_AGE_MS).toISOString()).limit(20).get();
    for (const doc of old.docs) {
      await deleteBlob(db, (doc.data() as StoredDraft).blobId).catch(() => {});
      await doc.ref.delete();
    }
    return old.size;
  } catch {
    return 0;
  }
}

/* ── Public API: picks the right store ──────────────────────────────────────────────────────────────────── */

export async function putDraft(bytes: Buffer, image: InspectedImage, meta: NewDraft): Promise<DraftInfo> {
  return usesRemoteJobs() ? remotePut(bytes, image, meta) : localPut(bytes, image, meta);
}

export async function getDraftInfo(id: string): Promise<DraftInfo> {
  if (!isValidId(id, "drf")) throw new DraftNotFoundError();
  return usesRemoteJobs() ? publicInfo(await remoteStored(id)) : localInfo(id);
}

export async function getDraft(id: string): Promise<{ info: DraftInfo; bytes: Buffer }> {
  if (!isValidId(id, "drf")) throw new DraftNotFoundError();
  return usesRemoteJobs() ? remoteGet(id) : localGet(id);
}

export async function markDraftSaved(id: string, imageId: string): Promise<DraftInfo> {
  return usesRemoteJobs() ? remoteMarkSaved(id, imageId) : localMarkSaved(id, imageId);
}

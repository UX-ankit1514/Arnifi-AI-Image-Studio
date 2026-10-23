import "server-only";
import { COLLECTIONS, getDb, StorageUnavailableError, hasStorage } from "@/lib/database/firestore";
import { isValidId, newId } from "@/lib/ids";
import { chunkId, CHUNK_BYTES, joinChunks } from "@/lib/storage/chunks";
import { FileValidationError, LIMITS } from "@/lib/validation/files";

/*
 * Uploads in pieces, for the live site: Vercel refuses request bodies over 4.5 MB, so files above 4 MB are sent as
 * ≤900 KB parts (one Firestore document each), joined and checked on "complete", then the parts are deleted.
 */

export const UPLOAD_PART_BYTES = CHUNK_BYTES;
const MAX_PARTS = Math.ceil(LIMITS.maxBytes / UPLOAD_PART_BYTES);

function ref(id: string) {
  return getDb().collection(COLLECTIONS.uploads).doc(id);
}

export async function startUpload(sessionId: string): Promise<string> {
  if (!hasStorage()) throw new StorageUnavailableError();
  const id = newId("upl");
  await ref(id).create({ sessionId, createdAt: new Date().toISOString() });
  return id;
}

async function owned(id: string, sessionId: string) {
  if (!isValidId(id, "upl")) throw new FileValidationError("corrupt", "This upload isn’t available any more. Choose the file again.");
  const snap = await ref(id).get();
  if (!snap.exists || snap.get("sessionId") !== sessionId) throw new FileValidationError("corrupt", "This upload isn’t available any more. Choose the file again.");
}

export async function putUploadPart(id: string, sessionId: string, index: number, bytes: Buffer): Promise<void> {
  await owned(id, sessionId);
  if (!Number.isInteger(index) || index < 0 || index >= MAX_PARTS) throw new FileValidationError("too_large", `This image is too big. The limit is ${LIMITS.maxBytes / 1024 / 1024} MB.`);
  if (bytes.length === 0 || bytes.length > UPLOAD_PART_BYTES) throw new FileValidationError("corrupt", "Part of the upload went missing. Try again.");
  await ref(id).collection("parts").doc(chunkId(index)).set({ index, data: bytes });
}

/** Joins the parts in order, then removes them. The joined file is validated by the caller like any upload. */
export async function finishUpload(id: string, sessionId: string, parts: number): Promise<Buffer> {
  await owned(id, sessionId);
  if (!Number.isInteger(parts) || parts < 1 || parts > MAX_PARTS) throw new FileValidationError("corrupt", "Part of the upload went missing. Try again.");
  const refs = Array.from({ length: parts }, (_, i) => ref(id).collection("parts").doc(chunkId(i)));
  const docs = await getDb().getAll(...refs);
  if (docs.some((d) => !d.exists)) throw new FileValidationError("corrupt", "Part of the upload went missing. Try again.");
  const bytes = joinChunks(docs.map((d) => Buffer.from(d.get("data") as Uint8Array)));
  const batch = getDb().batch();
  for (const r of refs) batch.delete(r);
  batch.delete(ref(id));
  await batch.commit().catch(() => {});
  return bytes;
}

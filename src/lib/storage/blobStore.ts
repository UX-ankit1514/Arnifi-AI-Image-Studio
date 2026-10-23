import "server-only";
import type { Firestore } from "firebase-admin/firestore";
import { COLLECTIONS } from "@/lib/database/firestore";
import { newId } from "@/lib/ids";
import { CHUNKS_PER_BATCH, chunkId, groupsOf, joinChunks, sha256, splitIntoChunks } from "./chunks";

/*
 * Image files in Firestore (the user's choice: everything in Firestore, free plan). `blobs/{id}` describes the file,
 * `blobs/{id}/chunks/c0000…` hold the bytes. The description is written last and marked complete, so a half-written
 * file is never treated as real; every read is checked against the stored SHA-256.
 */

export interface BlobInfo {
  id: string;
  mimeType: string;
  size: number;
  sha256: string;
  chunkCount: number;
}

export class MissingFileError extends Error {
  constructor(message = "This image’s file is missing or incomplete.") {
    super(message);
    this.name = "MissingFileError";
  }
}

export async function putBlob(db: Firestore, bytes: Buffer, mimeType: string): Promise<BlobInfo> {
  const id = newId("blob");
  const ref = db.collection(COLLECTIONS.blobs).doc(id);
  const chunks = splitIntoChunks(bytes);
  const written: string[] = [];
  try {
    for (const group of groupsOf(chunks.map((data, index) => ({ data, index })), CHUNKS_PER_BATCH)) {
      const batch = db.batch();
      for (const c of group) batch.set(ref.collection(COLLECTIONS.chunks).doc(chunkId(c.index)), { index: c.index, data: c.data });
      await batch.commit();
      written.push(...group.map((c) => chunkId(c.index)));
    }
    const info: BlobInfo = { id, mimeType, size: bytes.length, sha256: sha256(bytes), chunkCount: chunks.length };
    await ref.create({ ...info, complete: true, createdAt: new Date().toISOString() });
    return info;
  } catch (e) {
    await Promise.allSettled(written.map((c) => ref.collection(COLLECTIONS.chunks).doc(c).delete()));
    throw e;
  }
}

export async function readBlob(db: Firestore, id: string): Promise<{ bytes: Buffer; info: BlobInfo }> {
  const ref = db.collection(COLLECTIONS.blobs).doc(id);
  const snap = await ref.get();
  const meta = snap.data() as (BlobInfo & { complete?: boolean }) | undefined;
  if (!snap.exists || !meta?.complete) throw new MissingFileError();
  const refs = Array.from({ length: meta.chunkCount }, (_, i) => ref.collection(COLLECTIONS.chunks).doc(chunkId(i)));
  const docs = refs.length ? await db.getAll(...refs) : [];
  const parts: Buffer[] = [];
  for (const d of docs) {
    const data = d.get("data") as Buffer | Uint8Array | undefined;
    if (!d.exists || !data) throw new MissingFileError();
    parts.push(Buffer.from(data));
  }
  const bytes = joinChunks(parts);
  if (bytes.length !== meta.size || sha256(bytes) !== meta.sha256) throw new MissingFileError("This image’s file is damaged (it doesn’t match what was saved).");
  return { bytes, info: { id, mimeType: meta.mimeType, size: meta.size, sha256: meta.sha256, chunkCount: meta.chunkCount } };
}

export async function deleteBlob(db: Firestore, id: string): Promise<void> {
  const ref = db.collection(COLLECTIONS.blobs).doc(id);
  const chunks = await ref.collection(COLLECTIONS.chunks).listDocuments();
  for (const group of groupsOf(chunks, 400)) {
    const batch = db.batch();
    for (const c of group) batch.delete(c);
    await batch.commit();
  }
  await ref.delete();
}

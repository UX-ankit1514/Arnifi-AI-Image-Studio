import { createHash } from "node:crypto";

/*
 * Firestore documents are capped at 1 MiB, so each image file is stored as numbered chunks of at most 900 KB
 * (PRD §18: everything in Firestore, per the user's choice). Pure helpers, unit-tested.
 */
export const CHUNK_BYTES = 900 * 1024;
/** Chunks per write batch: 8 × 900 KB stays well under Firestore's 10 MiB request limit. */
export const CHUNKS_PER_BATCH = 8;

export function splitIntoChunks(bytes: Buffer, size = CHUNK_BYTES): Buffer[] {
  if (size <= 0) throw new Error("chunk size must be positive");
  const chunks: Buffer[] = [];
  for (let i = 0; i < bytes.length; i += size) chunks.push(bytes.subarray(i, Math.min(i + size, bytes.length)));
  return chunks.length ? chunks : [Buffer.alloc(0)];
}

export function joinChunks(chunks: Buffer[]): Buffer {
  return Buffer.concat(chunks);
}

export function sha256(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

export function chunkId(index: number): string {
  return `c${String(index).padStart(4, "0")}`;
}

export function groupsOf<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

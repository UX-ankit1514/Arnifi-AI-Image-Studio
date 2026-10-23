import "server-only";
import type { Firestore } from "firebase-admin/firestore";
import { newId } from "@/lib/ids";
import { makeThumbnail, type Thumbnail } from "@/lib/images/process";
import { deleteBlob, MissingFileError, putBlob, readBlob } from "@/lib/storage/blobStore";
import type { InspectedImage } from "@/lib/validation/files";
import type { ImagePatch, ImageRecord } from "@/types/image";
import { COLLECTIONS, getDb, hasStorage } from "./firestore";
import { FixtureImageStore } from "./fixtureRepository";
import { toImageDoc, toImageRecord } from "./imageMapping";

/*
 * The image library (PRD §13, §18). Metadata in `images/{id}`, the original bytes in a blob, a WebP thumbnail in
 * `thumbs/{id}`. Saving never overwrites: every save is a new id created with `create()`, which fails rather than
 * replacing an existing document (PRD §13.2 "prevent duplicate ids").
 *
 * Reads go through a short in-memory cache of all metadata so search and the grid don't spend Firestore's free daily
 * read allowance on every keystroke; this server's own writes update the cache immediately.
 */

export type NewImage = Omit<ImageRecord, "id" | "blobId" | "width" | "height" | "format" | "mimeType" | "fileSize" | "hasAlpha" | "createdAt" | "updatedAt" | "rootImageId"> & {
  rootImageId: string | null;
  createdAt?: string;
};

export interface ImageStore {
  readonly kind: "firestore" | "fixtures";
  list(): Promise<ImageRecord[]>;
  get(id: string): Promise<ImageRecord | null>;
  getFile(id: string): Promise<{ record: ImageRecord; bytes: Buffer }>;
  getThumb(id: string): Promise<Thumbnail | null>;
  create(input: NewImage, bytes: Buffer, info: InspectedImage): Promise<ImageRecord>;
  update(id: string, patch: ImagePatch): Promise<ImageRecord>;
}

export class ImageNotFoundError extends Error {
  constructor() {
    super("This image isn’t in the library any more.");
    this.name = "ImageNotFoundError";
  }
}

const CACHE_MS = 60_000;

export class FirestoreImageStore implements ImageStore {
  readonly kind = "firestore" as const;
  private cache: { at: number; records: Map<string, ImageRecord> } | null = null;

  constructor(private readonly db: Firestore) {}

  private async all(): Promise<Map<string, ImageRecord>> {
    if (this.cache && Date.now() - this.cache.at < CACHE_MS) return this.cache.records;
    const snap = await this.db.collection(COLLECTIONS.images).get();
    const records = new Map(snap.docs.map((d) => [d.id, toImageRecord(d.id, d.data())]));
    this.cache = { at: Date.now(), records };
    return records;
  }

  invalidate() {
    this.cache = null;
  }

  async list(): Promise<ImageRecord[]> {
    return [...(await this.all()).values()];
  }

  async get(id: string): Promise<ImageRecord | null> {
    const cached = this.cache?.records.get(id);
    if (cached) return cached;
    const snap = await this.db.collection(COLLECTIONS.images).doc(id).get();
    return snap.exists ? toImageRecord(snap.id, snap.data()!) : null;
  }

  async getFile(id: string): Promise<{ record: ImageRecord; bytes: Buffer }> {
    const record = await this.get(id);
    if (!record) throw new ImageNotFoundError();
    if (!record.blobId) throw new MissingFileError();
    const { bytes } = await readBlob(this.db, record.blobId);
    return { record, bytes };
  }

  async getThumb(id: string): Promise<Thumbnail | null> {
    const snap = await this.db.collection(COLLECTIONS.thumbs).doc(id).get();
    if (!snap.exists) return null;
    const d = snap.data()!;
    return { data: Buffer.from(d.data as Uint8Array), width: d.width as number, height: d.height as number, mimeType: "image/webp" };
  }

  async create(input: NewImage, bytes: Buffer, info: InspectedImage): Promise<ImageRecord> {
    const thumb = await makeThumbnail(bytes);
    const blob = await putBlob(this.db, bytes, info.mimeType);
    const now = new Date().toISOString();
    for (let attempt = 0; attempt < 3; attempt++) {
      const id = newId("img");
      const record: ImageRecord = {
        ...input,
        id,
        blobId: blob.id,
        width: info.width,
        height: info.height,
        format: info.format,
        mimeType: info.mimeType,
        fileSize: info.size,
        hasAlpha: info.hasAlpha,
        rootImageId: input.rootImageId ?? id,
        createdAt: input.createdAt ?? now,
        updatedAt: now,
      };
      try {
        await this.db.collection(COLLECTIONS.thumbs).doc(id).create({ data: thumb.data, width: thumb.width, height: thumb.height, mimeType: thumb.mimeType });
        await this.db.collection(COLLECTIONS.images).doc(id).create(toImageDoc(record));
        this.cache?.records.set(id, record);
        return record;
      } catch (e) {
        await this.db.collection(COLLECTIONS.thumbs).doc(id).delete().catch(() => {});
        if (isAlreadyExists(e) && attempt < 2) continue;
        await deleteBlob(this.db, blob.id).catch(() => {});
        throw e;
      }
    }
    throw new Error("Could not create a unique image id.");
  }

  async update(id: string, patch: ImagePatch): Promise<ImageRecord> {
    const ref = this.db.collection(COLLECTIONS.images).doc(id);
    const updated = await this.db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) throw new ImageNotFoundError();
      const next = { ...toImageRecord(id, snap.data()!), ...patch, updatedAt: new Date().toISOString() };
      tx.update(ref, { ...patch, updatedAt: next.updatedAt });
      return next;
    });
    this.cache?.records.set(id, updated);
    return updated;
  }
}

function isAlreadyExists(e: unknown): boolean {
  return typeof e === "object" && e !== null && ((e as { code?: unknown }).code === 6 || /ALREADY_EXISTS/.test(String((e as Error).message)));
}

const g = globalThis as unknown as { __imageStore?: ImageStore };

/** The real library when Firestore is configured; read-only demo fixtures otherwise (PRD §16.5). */
export function getImageStore(): ImageStore {
  if (g.__imageStore) return g.__imageStore;
  g.__imageStore = hasStorage() ? new FirestoreImageStore(getDb()) : new FixtureImageStore();
  return g.__imageStore;
}

/** Tests swap the store between runs. */
export function resetImageStore() {
  g.__imageStore = undefined;
}

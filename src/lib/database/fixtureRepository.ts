import "server-only";
import { readFile, stat } from "node:fs/promises";
import { makeThumbnail, type Thumbnail } from "@/lib/images/process";
import { inspectImage, type InspectedImage } from "@/lib/validation/files";
import type { ImagePatch, ImageRecord } from "@/types/image";
import { StorageUnavailableError } from "./firestore";
import type { ImageStore, NewImage } from "./imageRepository";
import { loadSeedManifest, SEED_ATTRIBUTION, type SeedEntry } from "./seedManifest";

/*
 * Read-only demo fixtures, used only while Firestore isn't configured (PRD §16.5: keep the app usable with clearly
 * marked demo content, never pretend to save). Records come from seed/manifest.json and the photos are read from their
 * original folders on this computer. Every write throws StorageUnavailableError, which the UI explains.
 */
export class FixtureImageStore implements ImageStore {
  readonly kind = "fixtures" as const;
  private records: Promise<Map<string, { record: ImageRecord; entry: SeedEntry }>> | null = null;
  private thumbs = new Map<string, Promise<Thumbnail>>();

  private load() {
    this.records ??= (async () => {
      const map = new Map<string, { record: ImageRecord; entry: SeedEntry }>();
      let entries: SeedEntry[] = [];
      try {
        entries = loadSeedManifest();
      } catch {
        return map;
      }
      await Promise.all(
        entries.map(async (entry) => {
          try {
            const bytes = await readFile(/*turbopackIgnore: true*/ entry.path);
            const info: InspectedImage = await inspectImage(bytes, { maxBytes: 40 * 1024 * 1024 });
            const created = (await stat(/*turbopackIgnore: true*/ entry.path)).mtime.toISOString();
            map.set(entry.fixtureId, {
              entry,
              record: {
                id: entry.fixtureId,
                title: entry.title,
                category: entry.category,
                tags: entry.tags,
                sourceType: "uploaded",
                blobId: "",
                width: info.width,
                height: info.height,
                format: info.format,
                mimeType: info.mimeType,
                fileSize: info.size,
                hasAlpha: info.hasAlpha,
                createdAt: created,
                updatedAt: created,
                prompt: null,
                finalPrompt: null,
                promptTemplateId: null,
                promptTemplateTitle: null,
                provider: null,
                model: null,
                parentImageId: null,
                rootImageId: entry.fixtureId,
                version: 1,
                notes: "Demo fixture — shown because saving isn’t set up yet. Not stored in the library.",
                campaign: null,
                usageContext: entry.usageContext,
                owner: null,
                attribution: SEED_ATTRIBUTION,
                seeded: true,
              },
            });
          } catch {
            /* a missing source photo is simply left out */
          }
        }),
      );
      return map;
    })();
    return this.records;
  }

  async list(): Promise<ImageRecord[]> {
    return [...(await this.load()).values()].map((v) => v.record);
  }

  async get(id: string): Promise<ImageRecord | null> {
    return (await this.load()).get(id)?.record ?? null;
  }

  async getFile(id: string): Promise<{ record: ImageRecord; bytes: Buffer }> {
    const hit = (await this.load()).get(id);
    if (!hit) throw new StorageUnavailableError("This demo image isn’t available.");
    return { record: hit.record, bytes: await readFile(/*turbopackIgnore: true*/ hit.entry.path) };
  }

  async getThumb(id: string): Promise<Thumbnail | null> {
    const hit = (await this.load()).get(id);
    if (!hit) return null;
    if (!this.thumbs.has(id)) this.thumbs.set(id, readFile(/*turbopackIgnore: true*/ hit.entry.path).then(makeThumbnail));
    return this.thumbs.get(id)!;
  }

  async create(_input: NewImage, _bytes: Buffer, _info: InspectedImage): Promise<ImageRecord> {
    void _input;
    void _bytes;
    void _info;
    throw new StorageUnavailableError();
  }

  async update(_id: string, _patch: ImagePatch): Promise<ImageRecord> {
    void _id;
    void _patch;
    throw new StorageUnavailableError();
  }
}

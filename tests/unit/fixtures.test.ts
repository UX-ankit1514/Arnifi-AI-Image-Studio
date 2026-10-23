import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { StorageUnavailableError } from "@/lib/database/firestore";
import { FixtureImageStore } from "@/lib/database/fixtureRepository";
import { getImageStore } from "@/lib/database/imageRepository";
import { loadSeedManifest } from "@/lib/database/seedManifest";

/* PRD §16.5: without storage credentials the app shows clearly marked, read-only demo fixtures and never fakes a save. */
const entries = loadSeedManifest();
const photosHere = entries.every((e) => existsSync(e.path));

describe("demo fixtures (no storage configured)", () => {
  it("the manifest lists 24 text-free starting photos with titles, categories and tags", () => {
    expect(entries).toHaveLength(24);
    expect(new Set(entries.map((e) => e.fixtureId)).size).toBe(24);
    for (const e of entries) {
      expect(e.title).toMatch(/^[A-Z]/);
      expect(e.tags.length).toBeGreaterThan(1);
    }
    expect(entries.filter((e) => e.tags.includes("Dubai")).length).toBeGreaterThanOrEqual(6);
  });

  it("without a key the app uses the read-only fixture store", () => {
    expect(getImageStore().kind).toBe("fixtures");
  });

  it.skipIf(!photosHere)("serves the photos read-only and refuses to save", async () => {
    const store = new FixtureImageStore();
    const all = await store.list();
    expect(all).toHaveLength(24);
    expect(all.every((r) => r.seeded && r.notes?.startsWith("Demo fixture"))).toBe(true);
    const thumb = await store.getThumb(all[0].id);
    expect(thumb?.mimeType).toBe("image/webp");
    await expect(store.update(all[0].id, { title: "x" })).rejects.toBeInstanceOf(StorageUnavailableError);
  });
});

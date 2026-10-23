import { describe, expect, it } from "vitest";
import { toImageDoc, toImageRecord } from "@/lib/database/imageMapping";
import { categoryCounts, filterImages, matchesQuery, tokenize } from "@/lib/images/search";
import { describeEditChain, familyOf, lineage, nextVersion } from "@/lib/images/versions";
import { downloadName } from "@/lib/images/process";
import { titleFromText } from "@/lib/titles";
import type { ImageRecord } from "@/types/image";

function rec(id: string, patch: Partial<ImageRecord> = {}): ImageRecord {
  return toImageRecord(id, { title: id, category: "Website", tags: [], sourceType: "uploaded", blobId: `blob_${id}`, width: 100, height: 50, format: "png", fileSize: 10, createdAt: "2026-10-01T00:00:00.000Z", ...patch });
}

describe("metadata mapping (PRD §13.1)", () => {
  it("fills safe defaults for old or partial documents", () => {
    const r = toImageRecord("img_abcd", { title: "Hi" });
    expect(r).toMatchObject({ id: "img_abcd", title: "Hi", category: "Uncategorised", tags: [], sourceType: "uploaded", format: "png", mimeType: "image/png", rootImageId: "img_abcd", version: 1, parentImageId: null, seeded: false });
  });

  it("round-trips every field and keeps the id out of the document", () => {
    const r = rec("img_round", { prompt: "p", finalPrompt: "fp", promptTemplateId: "corporate-photography", provider: "codex", model: "m", parentImageId: "img_p", rootImageId: "img_root", version: 3, tags: ["Dubai"], hasAlpha: true });
    const doc = toImageDoc(r);
    expect("id" in doc).toBe(false);
    expect(toImageRecord("img_round", doc as unknown as Record<string, unknown>)).toEqual(r);
  });

  it("rejects unknown enums instead of trusting them", () => {
    const r = toImageRecord("img_x", { sourceType: "magic", format: "gif", version: -2 });
    expect(r).toMatchObject({ sourceType: "uploaded", format: "png", version: 1 });
  });
});

describe("search and filters (PRD FR-01)", () => {
  const items = [
    rec("img_a", { title: "Business Setup in Dubai", tags: ["office"], createdAt: "2026-10-02T00:00:00Z" }),
    rec("img_b", { title: "Riyadh skyline", tags: ["Saudi Arabia", "business setup"], category: "Campaigns", createdAt: "2026-10-03T00:00:00Z" }),
    rec("img_c", { title: "Quiet desk", prompt: "A Dubai office at dawn", sourceType: "generated", createdAt: "2026-10-04T00:00:00Z" }),
  ];

  it("matches every word against the start of words in title, tags, category and prompt", () => {
    expect(filterImages(items, { q: "Dubai business" }).map((r) => r.id)).toEqual(["img_a"]);
    expect(filterImages(items, { q: "dubai" }).map((r) => r.id)).toEqual(["img_a", "img_c"]);
    expect(matchesQuery(items[0], "offices")).toBe(true);
    expect(matchesQuery(items[0], "ubai")).toBe(false);
    expect(tokenize("Café, Dubai!")).toEqual(["cafe", "dubai"]);
  });

  it("filters by category and source, newest first when not searching", () => {
    expect(filterImages(items, { category: "campaigns" }).map((r) => r.id)).toEqual(["img_b"]);
    expect(filterImages(items, { source: "generated" }).map((r) => r.id)).toEqual(["img_c"]);
    expect(filterImages(items, {}).map((r) => r.id)).toEqual(["img_c", "img_b", "img_a"]);
    expect(filterImages(items, { q: "nothing-like-this" })).toEqual([]);
  });

  it("builds category chips from the images actually in the library", () => {
    expect(categoryCounts(items)).toEqual([
      { name: "Website", count: 2 },
      { name: "Campaigns", count: 1 },
    ]);
  });
});

describe("version relationships (PRD §13.2, §15.3)", () => {
  const v1 = rec("img_v1", { rootImageId: "img_v1", version: 1 });
  const v2 = rec("img_v2", { rootImageId: "img_v1", parentImageId: "img_v1", version: 2, sourceType: "edited" });
  const v3 = rec("img_v3", { rootImageId: "img_v1", parentImageId: "img_v1", version: 3, sourceType: "edited" });
  const v4 = rec("img_v4", { rootImageId: "img_v1", parentImageId: "img_v3", version: 4, sourceType: "edited" });
  const other = rec("img_o");

  it("groups a family and numbers new versions after the highest one", () => {
    expect(familyOf([v3, other, v1, v4, v2], "img_v1").map((r) => r.version)).toEqual([1, 2, 3, 4]);
    expect(nextVersion([v1, v3])).toBe(4);
    expect(nextVersion([])).toBe(1);
  });

  it("follows parents back to the original, even with branches", () => {
    expect(lineage([v1, v2, v3, v4], v4).map((r) => r.id)).toEqual(["img_v1", "img_v3", "img_v4"]);
    expect(lineage([v1], v1).map((r) => r.id)).toEqual(["img_v1"]);
  });

  it("describes chains of edit instructions", () => {
    expect(describeEditChain(["Brighter"])).toBe("Brighter");
    expect(describeEditChain(["Brighter", "Remove plant"])).toBe("Edit 1: Brighter → Edit 2: Remove plant");
  });
});

describe("names", () => {
  it("download names are clean slugs with the version", () => {
    expect(downloadName("Dubai Office Visual", 2, "png")).toBe("dubai-office-visual-v2.png");
    expect(downloadName("Café — Déjà vu!", 1, "jpg")).toBe("cafe-deja-vu.jpg");
    expect(downloadName("???", 1, "png")).toBe("arnifi-image.png");
  });

  it("suggests a short Title Case title from a brief", () => {
    expect(titleFromText("Create a premium realistic image of a professional entrepreneur standing inside a modern Dubai office, with soft light.", "x")).toBe("Professional Entrepreneur Standing Inside a Modern Dubai Office");
    expect(titleFromText("   ", "Generated Image")).toBe("Generated Image");
  });
});

import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { FileValidationError, inspectImage, LIMITS, sniffImageType } from "@/lib/validation/files";
import { precheckFile } from "@/lib/validation/limits";
import { editRequestSchema, generateRequestSchema, imageMetaSchema, parseTagList } from "@/lib/validation/schemas";

const png = (w = 200, h = 100, alpha = 1) => sharp({ create: { width: w, height: h, channels: 4, background: { r: 46, g: 46, b: 163, alpha } } }).png().toBuffer();

async function code(p: Promise<unknown>): Promise<string> {
  try {
    await p;
    return "ok";
  } catch (e) {
    return e instanceof FileValidationError ? e.code : `other: ${e}`;
  }
}

describe("file type validation (PRD FR-02, §18.3)", () => {
  it("recognises PNG, JPEG and WebP by their signature, not their name", async () => {
    expect(sniffImageType(await png())).toBe("png");
    expect(sniffImageType(await sharp(await png()).jpeg().toBuffer())).toBe("jpeg");
    expect(sniffImageType(await sharp(await png()).webp().toBuffer())).toBe("webp");
    expect(sniffImageType(Buffer.from("GIF89a……"))).toBeNull();
    expect(sniffImageType(Buffer.from("<svg xmlns=…"))).toBeNull();
  });

  it("reads size, format and real transparency", async () => {
    const opaque = await inspectImage(await png(300, 150));
    expect(opaque).toMatchObject({ format: "png", mimeType: "image/png", width: 300, height: 150, hasAlpha: false });
    const clear = await inspectImage(await png(300, 150, 0));
    expect(clear.hasAlpha).toBe(true);
  });

  it("rejects unsupported, empty, damaged, tiny and oversized files with a clear reason", async () => {
    const gif = await sharp(await png()).gif().toBuffer();
    expect(await code(inspectImage(gif))).toBe("unsupported_type");
    expect(await code(inspectImage(Buffer.alloc(0)))).toBe("empty");
    const truncated = (await png(400, 400)).subarray(0, 60);
    expect(await code(inspectImage(truncated))).toBe("corrupt");
    expect(await code(inspectImage(await png(32, 32)))).toBe("too_small");
    expect(await code(inspectImage(Buffer.concat([await png(), Buffer.alloc(LIMITS.maxBytes)])))).toBe("too_large");
    const err = await inspectImage(gif).catch((e) => e);
    expect(err.message).toMatch(/PNG, JPG or WebP/);
  });

  it("the browser pre-check catches obvious problems before uploading", () => {
    expect(precheckFile({ name: "a.png", size: 10, type: "image/png" })).toBeNull();
    expect(precheckFile({ name: "a.gif", size: 10, type: "image/gif" })).toMatch(/PNG, JPG or WebP/);
    expect(precheckFile({ name: "a.jpg", size: LIMITS.maxBytes + 1, type: "image/jpeg" })).toMatch(/limit is 10 MB/);
  });
});

describe("request validation (PRD §14.2)", () => {
  it("needs a non-empty brief and applies safe defaults", () => {
    expect(() => generateRequestSchema.parse({ brief: "   " })).toThrow(/Describe the image/);
    const ok = generateRequestSchema.parse({ brief: " Dubai office " });
    expect(ok).toMatchObject({ brief: "Dubai office", templateId: null, applyBrandRules: true, options: { aspect: "landscape", quality: "standard", background: "normal" } });
    expect(() => generateRequestSchema.parse({ brief: "x".repeat(LIMITS.maxBriefChars + 1) })).toThrow(/under 2000/);
    expect(() => generateRequestSchema.parse({ brief: "x", options: { aspect: "panorama" } })).toThrow();
  });

  it("edits need a source and an instruction", () => {
    expect(() => editRequestSchema.parse({ source: { kind: "image", id: "img_1234" }, instruction: "" })).toThrow(/Describe the change/);
    expect(editRequestSchema.parse({ source: { kind: "draft", id: "drf_abcd" }, instruction: "brighter" }).editMode).toBe("general");
    expect(() => editRequestSchema.parse({ source: { kind: "url", id: "x" }, instruction: "brighter" })).toThrow();
  });

  it("cleans tags: trims, de-duplicates (case-insensitive), drops blanks", () => {
    expect(parseTagList("Dubai, office,  dubai ,, Business setup")).toEqual(["Dubai", "office", "Business setup"]);
    expect(imageMetaSchema.parse({ title: " A ", category: "Blogs", tags: ["x", "X"] })).toMatchObject({ title: "A", tags: ["x"], notes: null });
    expect(() => imageMetaSchema.parse({ title: "", category: "Blogs" })).toThrow(/title/);
  });
});

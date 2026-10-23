import { describe, expect, it } from "vitest";
import { CHUNK_BYTES, chunkId, groupsOf, joinChunks, sha256, splitIntoChunks } from "@/lib/storage/chunks";
import { SlidingWindow } from "@/lib/security/slidingWindow";
import { isValidId, newId } from "@/lib/ids";

describe("chunked file storage (files in Firestore)", () => {
  it("splits into ≤900 KB pieces and joins back byte-for-byte", () => {
    const bytes = Buffer.from(Array.from({ length: CHUNK_BYTES * 2 + 123 }, (_, i) => i % 251));
    const chunks = splitIntoChunks(bytes);
    expect(chunks.map((c) => c.length)).toEqual([CHUNK_BYTES, CHUNK_BYTES, 123]);
    expect(joinChunks(chunks).equals(bytes)).toBe(true);
    expect(sha256(joinChunks(chunks))).toBe(sha256(bytes));
    expect(splitIntoChunks(Buffer.alloc(0))).toHaveLength(1);
  });

  it("orders chunk ids and batches writes", () => {
    expect([chunkId(10), chunkId(2)].sort()).toEqual(["c0002", "c0010"]);
    expect(groupsOf([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });
});

describe("ids (PRD §13.2: unique, never reused)", () => {
  it("are unique and validated by prefix", () => {
    const ids = new Set(Array.from({ length: 2000 }, () => newId("img")));
    expect(ids.size).toBe(2000);
    const id = newId("drf");
    expect(isValidId(id, "drf")).toBe(true);
    expect(isValidId(id, "img")).toBe(false);
    expect(isValidId("drf_../../etc")).toBe(false);
  });
});

describe("rate limiting window (PRD §21.2)", () => {
  it("counts hits inside the window only", () => {
    const w = new SlidingWindow(1000);
    w.hit("a", 0);
    w.hit("a", 500);
    w.hit("b", 600);
    expect(w.count("a", 900)).toBe(2);
    expect(w.count("a", 1200)).toBe(1);
    expect(w.oldest("a", 1200)).toBe(500);
    expect(w.count("a", 5000)).toBe(0);
  });
});

import type { ImageRecord } from "@/types/image";

/*
 * Version relationships (PRD §13.2, §15.3). Every saved image belongs to a family (rootImageId = the first image); an
 * edit records its direct parent and gets the next number in the family. Nothing is ever overwritten. Pure.
 */

export function familyOf(records: ImageRecord[], rootImageId: string): ImageRecord[] {
  return records.filter((r) => r.rootImageId === rootImageId).sort((a, b) => a.version - b.version || a.createdAt.localeCompare(b.createdAt));
}

/** Next version number in a family: one more than the highest so far (two edits of v1 become v2 and v3). */
export function nextVersion(family: Pick<ImageRecord, "version">[]): number {
  return family.reduce((max, r) => Math.max(max, r.version), 0) + 1;
}

/** Parent chain from the root down to (and including) the given image. */
export function lineage(records: ImageRecord[], image: ImageRecord): ImageRecord[] {
  const byId = new Map(records.map((r) => [r.id, r]));
  const chain: ImageRecord[] = [image];
  const seen = new Set([image.id]);
  let parentId = image.parentImageId;
  while (parentId && !seen.has(parentId)) {
    const parent = byId.get(parentId);
    if (!parent) break;
    chain.unshift(parent);
    seen.add(parentId);
    parentId = parent.parentImageId;
  }
  return chain;
}

/** "Edit 1: brighter background → Edit 2: remove the plant" — how an edited image's prompt is stored. */
export function describeEditChain(instructions: string[]): string {
  return instructions.length === 1 ? instructions[0] : instructions.map((s, i) => `Edit ${i + 1}: ${s}`).join(" → ");
}

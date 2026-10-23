import type { ImageRecord, SourceType } from "@/types/image";

/*
 * Library search (PRD §7.2 step 3, FR-01). Firestore has no full-text search, so the server filters the cached metadata:
 * every search word must match the start of a word in the title, tags, category, prompt, notes, campaign or usage
 * context. "Dubai business" finds "Business setup in Dubai"; "office" also finds "offices". Pure and unit-tested.
 */

function normalise(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

function stem(word: string): string {
  return word.length > 3 && word.endsWith("s") && !word.endsWith("ss") ? word.slice(0, -1) : word;
}

export function tokenize(text: string): string[] {
  return normalise(text)
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .map(stem);
}

export function searchableText(r: Pick<ImageRecord, "title" | "tags" | "category" | "prompt" | "notes" | "campaign" | "usageContext">): string {
  return [r.title, r.tags.join(" "), r.category, r.prompt ?? "", r.notes ?? "", r.campaign ?? "", r.usageContext ?? ""].join(" ");
}

export function matchesQuery(record: ImageRecord, query: string): boolean {
  const terms = tokenize(query);
  if (!terms.length) return true;
  const words = tokenize(searchableText(record));
  return terms.every((term) => words.some((word) => word.startsWith(term)));
}

/** Title and tag matches first, then newest. */
function score(record: ImageRecord, terms: string[]): number {
  const title = tokenize(record.title);
  const tags = tokenize(record.tags.join(" "));
  let s = 0;
  for (const t of terms) {
    if (title.some((w) => w.startsWith(t))) s += 3;
    if (tags.some((w) => w.startsWith(t))) s += 2;
  }
  return s;
}

export interface LibraryFilter {
  q?: string;
  category?: string | null;
  source?: SourceType | null;
}

export function filterImages(records: ImageRecord[], filter: LibraryFilter): ImageRecord[] {
  const q = filter.q?.trim() ?? "";
  const terms = tokenize(q);
  const out = records.filter(
    (r) =>
      (!filter.category || r.category.toLowerCase() === filter.category.toLowerCase()) &&
      (!filter.source || r.sourceType === filter.source) &&
      matchesQuery(r, q),
  );
  return out.sort((a, b) => (terms.length ? score(b, terms) - score(a, terms) : 0) || b.createdAt.localeCompare(a.createdAt));
}

/** Filter chips: the categories actually in use, with counts (PRD §7.2: categories reflect the real assets). */
export function categoryCounts(records: ImageRecord[]): { name: string; count: number }[] {
  const map = new Map<string, { name: string; count: number }>();
  for (const r of records) {
    const key = r.category.toLowerCase();
    const entry = map.get(key) ?? { name: r.category, count: 0 };
    entry.count++;
    map.set(key, entry);
  }
  return [...map.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

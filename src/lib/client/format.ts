/* Display formatting: unambiguous dates ("12 Oct 2026") per the DS copy rules, British spelling. */

export function formatDate(iso: string, withTime = false): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-GB", withTime ? { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" } : { day: "numeric", month: "short", year: "numeric" });
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function formatDims(w: number, h: number): string {
  return `${w} × ${h} px`;
}

export const FORMAT_LABEL = { png: "PNG", jpeg: "JPG", webp: "WebP" } as const;

export const SOURCE_LABEL = { uploaded: "Uploaded", generated: "AI generated", edited: "AI edited" } as const;

export function elapsed(fromIso: string | null, now: number): string {
  if (!fromIso) return "0:00";
  const s = Math.max(0, Math.floor((now - Date.parse(fromIso)) / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** "in about 25 minutes" / "at 16:55". */
export function resetPhrase(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return `after ${d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`;
}

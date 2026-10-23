import { randomBytes } from "node:crypto";

const ALPHABET = "0123456789abcdefghjkmnpqrstvwxyz";

/** Unique, URL-safe ids such as `img_7k2m9q4xw1rt` (PRD §13.2: every generated or edited image gets a new id). */
export function newId(prefix: "img" | "blob" | "job" | "drf"): string {
  const bytes = randomBytes(12);
  let out = "";
  for (const b of bytes) out += ALPHABET[b % 32];
  return `${prefix}_${out}`;
}

export const ID_PATTERN = /^(img|blob|job|drf|fx)_[0-9a-z]{4,40}$/;

export function isValidId(id: string, prefix?: string): boolean {
  return ID_PATTERN.test(id) && (!prefix || id.startsWith(`${prefix}_`));
}

import type { ImageFormat } from "@/types/image";

/*
 * Documented application limits (PRD FR-02, §21.3). Shared by the browser (early feedback) and the server (the real
 * check). 10 MB keeps every image comfortably inside Firestore's free 1 GiB and the 12 MB proxy body limit.
 */
export const LIMITS = {
  maxBytes: 10 * 1024 * 1024,
  maxPixels: 40_000_000,
  minSide: 64,
  acceptedTypes: ["image/png", "image/jpeg", "image/webp"],
  accept: ".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp",
  maxBriefChars: 2000,
  maxTitleChars: 120,
  maxTags: 20,
  maxTagChars: 40,
  maxNotesChars: 1000,
} as const;

export type FileErrorCode = "empty" | "too_large" | "unsupported_type" | "corrupt" | "too_many_pixels" | "too_small";

export class FileValidationError extends Error {
  constructor(
    readonly code: FileErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "FileValidationError";
  }
}

/** Reads the file signature — the extension and the browser's MIME type are never trusted. */
export function sniffImageType(bytes: Uint8Array): ImageFormat | null {
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a) {
    return "png";
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpeg";
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  ) {
    return "webp";
  }
  return null;
}

/** Quick browser-side check before uploading, so obvious mistakes show at once. The server checks again. */
export function precheckFile(file: { name: string; size: number; type: string }): string | null {
  if (file.size === 0) return "This file is empty. Choose an image file.";
  if (file.size > LIMITS.maxBytes) return `This image is ${(file.size / 1024 / 1024).toFixed(1)} MB. The limit is 10 MB.`;
  const typeOk = (LIMITS.acceptedTypes as readonly string[]).includes(file.type) || /\.(png|jpe?g|webp)$/i.test(file.name);
  if (!typeOk) return "Use a PNG, JPG or WebP image. Other formats aren’t supported.";
  return null;
}

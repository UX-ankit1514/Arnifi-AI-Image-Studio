import "server-only";
import sharp from "sharp";
import type { ImageFormat } from "@/types/image";

/* Server-side image work with sharp (PRD §16): thumbnails for the grid, and PNG/JPG downloads without resizing. */

export interface Thumbnail {
  data: Buffer;
  width: number;
  height: number;
  mimeType: "image/webp";
}

/** Big enough to cover a 4:3 grid card on a 2× screen; small enough to sit in one Firestore document. */
export async function makeThumbnail(bytes: Buffer): Promise<Thumbnail> {
  const { data, info } = await sharp(bytes, { limitInputPixels: 50_000_000 })
    .rotate()
    .resize({ width: 640, height: 480, fit: "outside", withoutEnlargement: true })
    .webp({ quality: 78, alphaQuality: 90 })
    .toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height, mimeType: "image/webp" };
}

export type DownloadFormat = "png" | "jpg";

/**
 * PRD FR-08: the same pixels, never resized or watermarked. A request for the file's own format returns the original
 * bytes untouched. PNG keeps transparency; JPG has none, so transparent areas are filled with white.
 */
export async function convertForDownload(bytes: Buffer, source: ImageFormat, format: DownloadFormat): Promise<{ data: Buffer; mimeType: string }> {
  if (format === "png" && source === "png") return { data: bytes, mimeType: "image/png" };
  if (format === "jpg" && source === "jpeg") return { data: bytes, mimeType: "image/jpeg" };
  const base = sharp(bytes, { limitInputPixels: 50_000_000 }).rotate(); // bake EXIF orientation in, or the copy looks rotated
  if (format === "png") return { data: await base.png({ compressionLevel: 8 }).toBuffer(), mimeType: "image/png" };
  return { data: await base.flatten({ background: "#ffffff" }).jpeg({ quality: 92, mozjpeg: true }).toBuffer(), mimeType: "image/jpeg" };
}

/** "Dubai Office Visual", v2, png → "dubai-office-visual-v2.png". */
export function downloadName(title: string, version: number, format: DownloadFormat): string {
  const slug =
    title
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "arnifi-image";
  return `${slug}${version > 1 ? `-v${version}` : ""}.${format}`;
}

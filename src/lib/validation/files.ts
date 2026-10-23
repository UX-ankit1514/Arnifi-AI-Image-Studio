import "server-only";
import sharp from "sharp";
import { MIME_BY_FORMAT, type ImageFormat } from "@/types/image";
import { FileValidationError, LIMITS, sniffImageType } from "./limits";

export { FileValidationError, LIMITS, sniffImageType };

export interface InspectedImage {
  format: ImageFormat;
  mimeType: string;
  width: number;
  height: number;
  size: number;
  hasAlpha: boolean;
}

/**
 * Checks that a file really is a supported image (PRD §18.3, §21.3): signature first, then a full decode with a pixel
 * limit so a malformed or oversized file is rejected before it is stored. Nothing uploaded is ever executed.
 */
export async function inspectImage(bytes: Buffer, { maxBytes = LIMITS.maxBytes }: { maxBytes?: number } = {}): Promise<InspectedImage> {
  if (bytes.length === 0) throw new FileValidationError("empty", "This file is empty. Choose an image file.");
  if (bytes.length > maxBytes) {
    throw new FileValidationError("too_large", `This image is ${formatMb(bytes.length)}. The limit is ${formatMb(maxBytes)}.`);
  }
  const format = sniffImageType(bytes);
  if (!format) throw new FileValidationError("unsupported_type", "Use a PNG, JPG or WebP image. Other formats aren’t supported.");

  let meta: Awaited<ReturnType<ReturnType<typeof sharp>["metadata"]>>;
  try {
    meta = await sharp(bytes, { limitInputPixels: LIMITS.maxPixels, failOn: "error" }).metadata();
  } catch {
    throw new FileValidationError("corrupt", "This image looks damaged and can’t be opened. Try exporting it again.");
  }
  if (!meta.width || !meta.height) throw new FileValidationError("corrupt", "This image looks damaged and can’t be opened. Try exporting it again.");

  // EXIF orientations 5–8 rotate the picture by 90°, so the size people see is swapped.
  const rotated = (meta.orientation ?? 1) >= 5;
  const width = rotated ? meta.height : meta.width;
  const height = rotated ? meta.width : meta.height;

  if (width * height > LIMITS.maxPixels) {
    throw new FileValidationError("too_many_pixels", `This image is ${(width * height / 1e6).toFixed(0)} megapixels. The limit is ${LIMITS.maxPixels / 1e6}.`);
  }
  if (Math.min(width, height) < LIMITS.minSide) {
    throw new FileValidationError("too_small", `This image is only ${width} × ${height} px. Use one at least ${LIMITS.minSide} px on each side.`);
  }

  let hasAlpha = false;
  if (meta.hasAlpha) {
    try {
      // Decode fully: catches truncated files that still have a valid header, and tells real transparency apart.
      const stats = await sharp(bytes, { limitInputPixels: LIMITS.maxPixels, failOn: "error" }).stats();
      hasAlpha = !stats.isOpaque;
    } catch {
      throw new FileValidationError("corrupt", "This image looks damaged and can’t be opened. Try exporting it again.");
    }
  } else {
    try {
      await sharp(bytes, { limitInputPixels: LIMITS.maxPixels, failOn: "error" }).resize(8, 8, { fit: "inside" }).raw().toBuffer();
    } catch {
      throw new FileValidationError("corrupt", "This image looks damaged and can’t be opened. Try exporting it again.");
    }
  }

  return { format, mimeType: MIME_BY_FORMAT[format], width, height, size: bytes.length, hasAlpha };
}

function formatMb(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(bytes < 10 * 1024 * 1024 ? 1 : 0)} MB`;
}

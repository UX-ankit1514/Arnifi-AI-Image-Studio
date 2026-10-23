import "server-only";
import type { AspectRatio } from "@/types/generation";
import { FileValidationError, inspectImage, type InspectedImage } from "@/lib/validation/files";
import { ProviderError, type RawProviderImage } from "./imageProvider";

/* normalizeImageResult (PRD §14.3): proves a provider reply is a real image and notes honest caveats about it. */

/** Provider results can be larger than people's uploads (big edits); they are still capped. */
const MAX_RESULT_BYTES = 40 * 1024 * 1024;

export function shapeOf(width: number, height: number): AspectRatio {
  const r = width / height;
  if (r > 1.1) return "landscape";
  if (r < 0.9) return "portrait";
  return "square";
}

export interface NormalizedImage extends InspectedImage {
  bytes: Buffer;
  warnings: string[];
}

export async function normalizeImageResult(raw: RawProviderImage, expect: { aspect?: AspectRatio; source?: { width: number; height: number } } = {}): Promise<NormalizedImage> {
  let info: InspectedImage;
  try {
    info = await inspectImage(raw.bytes, { maxBytes: MAX_RESULT_BYTES });
  } catch (e) {
    const why = e instanceof FileValidationError ? e.message : String(e);
    throw new ProviderError("provider_error", "The image service returned a file that isn’t a usable image. Try again.", { detail: why });
  }
  const warnings: string[] = [];
  if (expect.aspect) {
    const got = shapeOf(info.width, info.height);
    if (got !== expect.aspect) warnings.push(`You asked for ${expect.aspect}, but the image came back ${got} (${info.width} × ${info.height} px).`);
  }
  if (expect.source) {
    const before = shapeOf(expect.source.width, expect.source.height);
    const after = shapeOf(info.width, info.height);
    if (before !== after) warnings.push(`The edited image is ${after} (${info.width} × ${info.height} px), but the original is ${before}.`);
    else if (info.width !== expect.source.width || info.height !== expect.source.height)
      warnings.push(`The edited image is ${info.width} × ${info.height} px; the original is ${expect.source.width} × ${expect.source.height} px.`);
  }
  return { ...info, bytes: raw.bytes, warnings };
}

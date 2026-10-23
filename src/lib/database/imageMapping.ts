import { IMAGE_FORMATS, MIME_BY_FORMAT, SOURCE_TYPES, type ImageFormat, type ImageRecord, type SourceType } from "@/types/image";

/*
 * Firestore document ⇄ ImageRecord (PRD §13 metadata). Reading is defensive: a document missing optional fields, or
 * written by an older version, still maps to a complete record instead of crashing the library. Pure, unit-tested.
 */

const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v : null);
const num = (v: unknown, fallback = 0): number => (typeof v === "number" && Number.isFinite(v) ? v : fallback);

export function toImageRecord(id: string, data: Record<string, unknown>): ImageRecord {
  const format: ImageFormat = IMAGE_FORMATS.includes(data.format as ImageFormat) ? (data.format as ImageFormat) : "png";
  const sourceType: SourceType = SOURCE_TYPES.includes(data.sourceType as SourceType) ? (data.sourceType as SourceType) : "uploaded";
  const createdAt = str(data.createdAt) ?? new Date(0).toISOString();
  return {
    id,
    title: str(data.title) ?? "Untitled image",
    category: str(data.category) ?? "Uncategorised",
    tags: Array.isArray(data.tags) ? data.tags.filter((t): t is string => typeof t === "string" && t.trim() !== "") : [],
    sourceType,
    blobId: str(data.blobId) ?? "",
    width: num(data.width),
    height: num(data.height),
    format,
    mimeType: str(data.mimeType) ?? MIME_BY_FORMAT[format],
    fileSize: num(data.fileSize),
    hasAlpha: data.hasAlpha === true,
    createdAt,
    updatedAt: str(data.updatedAt) ?? createdAt,
    prompt: str(data.prompt),
    finalPrompt: str(data.finalPrompt),
    promptTemplateId: str(data.promptTemplateId),
    promptTemplateTitle: str(data.promptTemplateTitle),
    provider: str(data.provider),
    model: str(data.model),
    parentImageId: str(data.parentImageId),
    rootImageId: str(data.rootImageId) ?? id,
    version: Math.max(1, num(data.version, 1)),
    notes: str(data.notes),
    campaign: str(data.campaign),
    usageContext: str(data.usageContext),
    owner: str(data.owner),
    attribution: str(data.attribution),
    seeded: data.seeded === true,
  };
}

/** Everything except the id, which is the document id. */
export function toImageDoc(record: ImageRecord): Omit<ImageRecord, "id"> {
  const { id: _id, ...doc } = record;
  void _id;
  return doc;
}

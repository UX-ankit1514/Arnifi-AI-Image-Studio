/* Image asset records (PRD §13). Metadata lives in Firestore `images/{id}`; the bytes live in a separate blob. */

export const SOURCE_TYPES = ["uploaded", "generated", "edited"] as const;
export type SourceType = (typeof SOURCE_TYPES)[number];

export const IMAGE_FORMATS = ["png", "jpeg", "webp"] as const;
export type ImageFormat = (typeof IMAGE_FORMATS)[number];

export const MIME_BY_FORMAT: Record<ImageFormat, string> = {
  png: "image/png",
  jpeg: "image/jpeg",
  webp: "image/webp",
};

export interface ImageRecord {
  id: string;
  title: string;
  category: string;
  tags: string[];
  sourceType: SourceType;
  /** File location: the blob that holds the original, untouched bytes. */
  blobId: string;
  width: number;
  height: number;
  format: ImageFormat;
  mimeType: string;
  fileSize: number;
  /** True only when some pixels are actually transparent, not merely when the file has an alpha channel. */
  hasAlpha: boolean;
  createdAt: string;
  updatedAt: string;
  /** The person's own words: generation brief, or the chain of edit instructions. */
  prompt: string | null;
  /** Exactly what was sent to the provider, including the guideline and visual rules. */
  finalPrompt: string | null;
  promptTemplateId: string | null;
  promptTemplateTitle: string | null;
  provider: string | null;
  model: string | null;
  parentImageId: string | null;
  rootImageId: string;
  version: number;
  notes: string | null;
  campaign: string | null;
  usageContext: string | null;
  owner: string | null;
  attribution: string | null;
  /** Imported from the existing Arnifi photo archive by `npm run seed`. */
  seeded: boolean;
}

/** Fields a person can change from the details screen. */
export interface ImagePatch {
  title?: string;
  category?: string;
  tags?: string[];
  notes?: string | null;
  campaign?: string | null;
  usageContext?: string | null;
  owner?: string | null;
  attribution?: string | null;
}

/** What the library list endpoint returns: the records plus where they came from. */
export interface LibraryListing {
  images: ImageRecord[];
  categories: { name: string; count: number }[];
  total: number;
  /** "firestore" = real saved assets; "fixtures" = read-only demo images because storage isn't set up. */
  storage: "firestore" | "fixtures";
}

import type { ImageFormat } from "./image";

/* Generation and editing requests, jobs and drafts (PRD §14, §15). */

export const ASPECT_RATIOS = ["square", "portrait", "landscape"] as const;
export type AspectRatio = (typeof ASPECT_RATIOS)[number];

export const QUALITIES = ["standard", "high"] as const;
export type Quality = (typeof QUALITIES)[number];

export const BACKGROUNDS = ["normal", "transparent"] as const;
export type Background = (typeof BACKGROUNDS)[number];

export interface GenerationOptions {
  aspect: AspectRatio;
  quality: Quality;
  background: Background;
}

export const EDIT_MODES = ["general", "background"] as const;
export type EditMode = (typeof EDIT_MODES)[number];

/** Where an edit starts from: a saved library image, or an unsaved draft (a generated result, an upload, an earlier edit). */
export type SourceRef = { kind: "image"; id: string } | { kind: "draft"; id: string };

export type JobKind = "generate" | "edit";
/** PRD §14.5: idle is client-only; the server tracks the rest. */
export type JobStatus = "validating" | "queued" | "generating" | "completed" | "failed" | "cancelled";

export const ERROR_CODES = [
  "not_configured",
  "not_signed_in",
  "usage_limit",
  "rate_limited",
  "budget_reached",
  "content_refused",
  "invalid_request",
  "timeout",
  "unavailable",
  "capability",
  "interrupted",
  "storage_failed",
  "provider_error",
] as const;
export type ErrorCode = (typeof ERROR_CODES)[number];

export interface JobError {
  code: ErrorCode;
  message: string;
  retryable: boolean;
  /** When a usage limit lifts, if the provider said. */
  resetAt: string | null;
}

/** An unsaved image on this computer: a provider result, or an upload made in the editor. */
export interface DraftInfo {
  id: string;
  origin: "generate" | "edit" | "upload";
  format: ImageFormat;
  mimeType: string;
  width: number;
  height: number;
  size: number;
  hasAlpha: boolean;
  createdAt: string;
  jobId: string | null;
  /** For edits: the image this one was made from. */
  parent: SourceRef | null;
  instruction: string | null;
  originalName: string | null;
  /** Set once saved, so saving twice returns the same library image. */
  savedImageId: string | null;
}

export interface JobRequest {
  brief: string | null;
  instruction: string | null;
  templateId: string | null;
  templateTitle: string | null;
  placeholders: Record<string, string>;
  options: GenerationOptions;
  applyBrandRules: boolean;
  editMode: EditMode | null;
  source: SourceRef | null;
  composedPrompt: string;
}

export interface Job {
  id: string;
  kind: JobKind;
  status: JobStatus;
  sessionId: string;
  idempotencyKey: string | null;
  request: JobRequest;
  provider: string;
  model: string;
  error: JobError | null;
  output: DraftInfo | null;
  /** Honest notes about the result, e.g. the provider returned a different shape than requested. */
  warnings: string[];
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  savedImageId: string | null;
  /** Helper mode: which helper Mac is making it, and whether someone pressed Cancel while it was running. */
  helperId?: string | null;
  cancelRequested?: boolean;
}

/** GET /api/jobs/[id]: the job plus where it is in the queue. */
export interface JobView extends Job {
  queuePosition: number | null;
  /** A plain note about a wait, e.g. the helper Mac is offline. */
  note?: string | null;
}

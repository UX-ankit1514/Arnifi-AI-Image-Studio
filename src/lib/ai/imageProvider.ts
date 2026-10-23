import type { AspectRatio, Background, ErrorCode, GenerationOptions, Quality } from "@/types/generation";
import type { ImageFormat } from "@/types/image";

/*
 * Provider abstraction (PRD §14.3). The UI and the job runner only talk to this interface, so a different image model
 * is a new implementation of it — nothing else changes. One real implementation is wired for the MVP (Codex with the
 * ChatGPT plan); the OpenAI Image API implementation is ready for hosting.
 */

export interface SupportedOptions {
  aspect: {
    values: AspectRatio[];
    /** False when the shape is only requested in words and the provider decides the final size. */
    exact: boolean;
    note: string | null;
  };
  quality: { supported: boolean; values: Quality[]; note: string | null };
  background: { supported: boolean; values: Background[]; note: string | null };
  maxOutputs: number;
  edit: { supported: boolean; note: string | null };
}

export interface ProviderStatus {
  id: string;
  label: string;
  ready: boolean;
  model: string;
  /** One plain sentence about the connection. */
  detail: string;
  /** Steps to fix it when not ready. */
  fix: string[];
  checkedAt: string;
}

export interface GenerateImageRequest {
  prompt: string;
  options: GenerationOptions;
}

export interface EditImageRequest {
  prompt: string;
  image: { bytes: Buffer; format: ImageFormat; width: number; height: number };
}

/** Raw bytes as a provider returned them, before checking that they are a real image. */
export interface RawProviderImage {
  bytes: Buffer;
}

export interface ImageProvider {
  readonly id: string;
  readonly label: string;
  model(kind: "generate" | "edit"): string;
  getSupportedOptions(): SupportedOptions;
  status(force?: boolean): Promise<ProviderStatus>;
  generateImage(request: GenerateImageRequest, signal: AbortSignal): Promise<RawProviderImage>;
  editImage(request: EditImageRequest, signal: AbortSignal): Promise<RawProviderImage>;
}

/** A provider failure with a stable code; `message` is safe to show to people. */
export class ProviderError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly options: { retryable?: boolean; resetAt?: string | null; detail?: string } = {},
  ) {
    super(message);
    this.name = "ProviderError";
  }
  get retryable(): boolean {
    return this.options.retryable ?? RETRYABLE.has(this.code);
  }
  get resetAt(): string | null {
    return this.options.resetAt ?? null;
  }
}

const RETRYABLE = new Set<ErrorCode>(["usage_limit", "rate_limited", "timeout", "unavailable", "interrupted", "storage_failed", "provider_error"]);

/** Turns anything thrown during a provider call into a ProviderError with a plain message (PRD §21.5). */
export function handleProviderError(error: unknown): ProviderError {
  if (error instanceof ProviderError) return error;
  if (error instanceof Error && error.name === "AbortError") {
    return new ProviderError("interrupted", "This request was cancelled.", { retryable: true });
  }
  const text = error instanceof Error ? error.message : String(error);
  return new ProviderError("provider_error", "The image service ran into a problem. Try again in a moment.", { detail: text.slice(-500) });
}

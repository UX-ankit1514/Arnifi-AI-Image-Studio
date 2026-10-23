import "server-only";
import type { AspectRatio, Quality } from "@/types/generation";
import { MIME_BY_FORMAT } from "@/types/image";
import { ProviderError, type EditImageRequest, type GenerateImageRequest, type ImageProvider, type ProviderStatus, type RawProviderImage, type SupportedOptions } from "./imageProvider";

/*
 * OpenAI Image API (PRD §14.1), used when IMAGE_PROVIDER=openai and OPENAI_API_KEY is set — the route for hosting the
 * app online, since the Codex connection only works on the Mac where it is signed in. Parameters follow the current
 * image-generation guide (Oct 2026): gpt-image-2.5 models, size WIDTHxHEIGHT, quality low…max, background transparent
 * with png/webp, b64_json responses, `moderation_blocked` refusals. Covered by mocked tests; not yet run with a real key.
 */

const SIZES: Record<AspectRatio, string> = { square: "1024x1024", portrait: "1024x1536", landscape: "1536x1024" };
const QUALITY: Record<Quality, string> = { standard: "medium", high: "high" };
const API = "https://api.openai.com/v1";

export class OpenAIProvider implements ImageProvider {
  readonly id = "openai";
  readonly label = "OpenAI Image API";

  constructor(private readonly fetchImpl: typeof fetch = fetch) {}

  model(kind: "generate" | "edit"): string {
    return kind === "edit"
      ? process.env.OPENAI_EDIT_MODEL?.trim() || "gpt-image-2.5-sunburst"
      : process.env.OPENAI_IMAGE_MODEL?.trim() || "gpt-image-2.5-flare";
  }

  getSupportedOptions(): SupportedOptions {
    return {
      aspect: { values: ["square", "portrait", "landscape"], exact: true, note: null },
      quality: { supported: true, values: ["standard", "high"], note: null },
      background: { supported: true, values: ["normal", "transparent"], note: "Transparent backgrounds are saved as PNG." },
      maxOutputs: 1,
      edit: { supported: true, note: null },
    };
  }

  async status(): Promise<ProviderStatus> {
    const ready = Boolean(process.env.OPENAI_API_KEY?.trim());
    return {
      id: this.id,
      label: this.label,
      model: this.model("generate"),
      ready,
      detail: ready ? "An OpenAI API key is configured on the server. Images are billed to that OpenAI account." : "No OpenAI API key is configured on the server.",
      fix: ready ? [] : ["Add OPENAI_API_KEY to .env.local (never commit it).", "Restart the app."],
      checkedAt: new Date().toISOString(),
    };
  }

  async generateImage(request: GenerateImageRequest, signal: AbortSignal): Promise<RawProviderImage> {
    const transparent = request.options.background === "transparent";
    const body = {
      model: this.model("generate"),
      prompt: request.prompt,
      n: 1,
      size: SIZES[request.options.aspect],
      quality: QUALITY[request.options.quality],
      background: transparent ? "transparent" : "auto",
      output_format: "png",
    };
    return this.call("/images/generations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }, signal);
  }

  async editImage(request: EditImageRequest, signal: AbortSignal): Promise<RawProviderImage> {
    const form = new FormData();
    form.set("model", this.model("edit"));
    form.set("prompt", request.prompt);
    form.set("n", "1");
    form.set("output_format", "png");
    const ext = request.image.format === "jpeg" ? "jpg" : request.image.format;
    form.append("image[]", new Blob([new Uint8Array(request.image.bytes)], { type: MIME_BY_FORMAT[request.image.format] }), `source.${ext}`);
    return this.call("/images/edits", { method: "POST", body: form }, signal);
  }

  private async call(path: string, init: RequestInit, signal: AbortSignal): Promise<RawProviderImage> {
    const key = process.env.OPENAI_API_KEY?.trim();
    if (!key) throw new ProviderError("not_configured", "No OpenAI API key is configured on the server.", { retryable: false });
    let response: Response;
    try {
      response = await this.fetchImpl(`${API}${path}`, { ...init, signal, headers: { ...(init.headers as Record<string, string>), Authorization: `Bearer ${key}` } });
    } catch (e) {
      if (signal.aborted) throw new ProviderError("interrupted", "This request was cancelled.", { retryable: true });
      throw new ProviderError("unavailable", "The OpenAI image service can’t be reached right now. Try again.", { detail: String(e) });
    }
    const json = (await response.json().catch(() => null)) as OpenAIResponse | null;
    if (!response.ok) throw mapOpenAIError(response.status, json);
    const b64 = json?.data?.[0]?.b64_json;
    if (!b64) throw new ProviderError("provider_error", "The image service replied without an image. Try again.");
    return { bytes: Buffer.from(b64, "base64") };
  }
}

interface OpenAIResponse {
  data?: { b64_json?: string }[];
  error?: { message?: string; code?: string; type?: string };
}

/** Exported for tests. */
export function mapOpenAIError(status: number, json: OpenAIResponse | null): ProviderError {
  const code = json?.error?.code ?? "";
  const detail = json?.error?.message ?? `HTTP ${status}`;
  if (code === "moderation_blocked" || /content_policy|safety/.test(code)) {
    return new ProviderError("content_refused", "The image service declined this request under its content rules. Try describing it differently.", { retryable: false, detail });
  }
  if (status === 401) return new ProviderError("not_configured", "The OpenAI API key was rejected. Check it in .env.local.", { retryable: false, detail });
  if (status === 403) return new ProviderError("not_configured", "This OpenAI account doesn’t have access to the configured image model.", { retryable: false, detail });
  if (status === 429) {
    return /quota|billing/i.test(detail)
      ? new ProviderError("usage_limit", "The OpenAI account has run out of credit or quota.", { retryable: false, detail })
      : new ProviderError("rate_limited", "The image service is busy. Wait a moment and try again.", { detail });
  }
  if (status === 400) return new ProviderError("invalid_request", "The image service couldn’t use this request. Try changing the description or settings.", { retryable: false, detail });
  if (status >= 500) return new ProviderError("unavailable", "The image service is having problems right now. Try again shortly.", { detail });
  return new ProviderError("provider_error", "The image service ran into a problem. Try again.", { detail });
}

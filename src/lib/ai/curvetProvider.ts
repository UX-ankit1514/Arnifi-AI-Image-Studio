import "server-only";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { AspectRatio } from "@/types/generation";
import { ProviderError, type EditImageRequest, type GenerateImageRequest, type ImageProvider, type ProviderStatus, type RawProviderImage, type SupportedOptions } from "./imageProvider";

/*
 * Curvet (curvet.in) — the unified AI API the studio uses for images, with a GPT image model. Works the same on a Mac
 * and on Vercel: the server calls Curvet with the app key, nobody's laptop needs to be on.
 *
 * API, as used by the official @curvet/sdk (v0.13):
 *   base     https://curvet.ai/api/v1/playground           header  x-app-key: <key>
 *   POST /image   JSON { model, prompt, size: "WxH" }      → { success, imageUrl, usage, metadata }
 *   POST /image   multipart { model, prompt, size, image }  → edit request with the source photo attached
 *   GET  /models?type=image, GET /balance
 *
 * Tested 23 Oct 2026: through the API key, Curvet's image models ignore an attached photo (sent as `image`, `files`,
 * or `imageUrl`) and draw a new picture from the words; its dedicated edit models fail upstream. So edits currently
 * come back as a fresh image, and the Edit screen says so. The photo is still sent, so true edits start working
 * as soon as Curvet passes it through.
 *   GET  /models?type=image, GET /balance
 * The result is a URL; the server downloads the bytes straight away and stores them in the studio's own storage.
 */

const DEFAULT_BASE_URL = "https://curvet.ai/api/v1/playground";
/** OpenAI's GPT Image 2.5 Flare on Curvet (US$0.07 per image, Oct 2026), for new images and edits alike — the user's
 * choice: one model for everything. CURVET_IMAGE_MODEL / CURVET_EDIT_MODEL change it. */
const DEFAULT_MODEL = "gpt-image-2.5-flare";
const REQUEST_TIMEOUT_MS = 4 * 60_000;

const SIZES: Record<AspectRatio, string> = { square: "1024x1024", portrait: "1024x1536", landscape: "1536x1024" };

export function curvetBaseUrl(): string {
  return (process.env.CURVET_BASE_URL?.trim() || DEFAULT_BASE_URL).replace(/\/$/, "");
}

export function curvetModel(kind: "generate" | "edit" = "generate"): string {
  const generate = process.env.CURVET_IMAGE_MODEL?.trim() || DEFAULT_MODEL;
  return kind === "edit" ? process.env.CURVET_EDIT_MODEL?.trim() || generate : generate;
}

interface CurvetErrorBody {
  error?: string | { message?: string; code?: string };
  message?: string;
  code?: string;
  required?: number;
  available?: number;
  resetsAt?: string;
}

function messageOf(body: CurvetErrorBody | null): string {
  if (!body) return "";
  if (typeof body.error === "string") return body.error;
  return body.error?.message ?? body.message ?? "";
}

/** Maps a Curvet error response to a plain-language error (PRD §21.5). Exported for tests. */
export function mapCurvetError(status: number, body: CurvetErrorBody | null): ProviderError {
  const detail = `HTTP ${status}: ${messageOf(body)}`.slice(0, 500);
  const text = `${messageOf(body)} ${typeof body?.error === "object" ? body.error?.code ?? "" : ""} ${body?.code ?? ""}`;
  if (/moderation|content.?policy|safety|inappropriate|not allowed by our|violat/i.test(text)) {
    return new ProviderError("content_refused", "The image service declined this request under its content rules. Try describing it differently.", { retryable: false, detail });
  }
  if (status === 401) return new ProviderError("not_configured", "The Curvet API key was rejected. Check CURVET_API_KEY.", { retryable: false, detail });
  if (status === 403) return new ProviderError("not_configured", "This Curvet key isn’t allowed to use the image model. In Curvet, give the key the Image category (and this model).", { retryable: false, detail });
  if (status === 402) return new ProviderError("usage_limit", "The Curvet account has run out of credits. Top up the balance in Curvet, then try again.", { retryable: false, detail });
  if (status === 429) return new ProviderError("rate_limited", "The image service is busy or a usage cap was reached. Wait a moment and try again.", { resetAt: body?.resetsAt ?? null, detail });
  if (status === 400 || status === 404 || status === 422) {
    return new ProviderError("invalid_request", "The image service couldn’t use this request. Try changing the description or settings.", { retryable: false, detail });
  }
  if (status >= 500) return new ProviderError("unavailable", "The image service is having problems right now. Try again shortly.", { detail });
  return new ProviderError("provider_error", "The image service ran into a problem. Try again.", { detail });
}

export class CurvetProvider implements ImageProvider {
  readonly id = "curvet";
  readonly label = "Curvet · GPT Image";
  private cached: { at: number; status: ProviderStatus } | null = null;

  constructor(private readonly fetchImpl: typeof fetch = fetch) {}

  model(kind: "generate" | "edit"): string {
    return curvetModel(kind);
  }

  getSupportedOptions(): SupportedOptions {
    return {
      aspect: { values: ["square", "portrait", "landscape"], exact: true, note: null },
      quality: { supported: false, values: [], note: "Not adjustable through Curvet yet — the model’s default quality is used." },
      background: { supported: false, values: ["normal"], note: "Transparent backgrounds aren’t available through Curvet yet." },
      maxOutputs: 1,
      edit: {
        supported: true,
        note: "Through Curvet, the AI currently redraws the picture from your description instead of editing your photo — so the result can look quite different from the original. Your original is never changed.",
      },
    };
  }

  /** CURVET_API_KEY (Vercel, .env.local), or on a Mac the private file next to the Firebase key. */
  private key(): string | null {
    return secret("CURVET_API_KEY", "curvet-api-key.txt");
  }

  private headers(): Record<string, string> {
    const h: Record<string, string> = { "x-app-key": this.key() ?? "", accept: "application/json" };
    // Curvet pairs the app key with an app secret for server calls; sent when one is set up.
    const appSecret = secret("CURVET_APP_SECRET", "curvet-app-secret.txt");
    if (appSecret) h["x-app-secret"] = appSecret;
    return h;
  }

  async status(force = false): Promise<ProviderStatus> {
    if (!force && this.cached && Date.now() - this.cached.at < 60_000) return this.cached.status;
    const base = { id: this.id, label: this.label, model: this.model("generate"), checkedAt: new Date().toISOString() };
    let status: ProviderStatus;
    if (!this.key()) {
      status = {
        ...base,
        ready: false,
        detail: "No Curvet API key is set up on the server yet.",
        fix: process.env.VERCEL === "1"
          ? ["In vercel.com → this project → Settings → Environment Variables, add CURVET_API_KEY with your Curvet key (Production).", "Redeploy, then press Check Again."]
          : ["Copy your Curvet key, then in Terminal run: pbpaste > ~/.config/arnifi-image-studio/curvet-api-key.txt", "Press Check Again."],
      };
    } else {
      try {
        const res = await this.fetchImpl(`${curvetBaseUrl()}/balance`, { headers: this.headers(), signal: AbortSignal.timeout(15_000) });
        const body = (await res.json().catch(() => null)) as ({ balance?: unknown } & CurvetErrorBody) | null;
        if (res.ok) {
          const balance = formatBalance(body?.balance);
          const edit = this.model("edit");
          status = { ...base, ready: true, detail: `Connected to Curvet. Images${edit === base.model ? " and edits" : ""} use ${base.model}${edit === base.model ? "" : `, edits use ${edit}`}${balance ? ` · balance ${balance}` : ""}.`, fix: [] };
        } else {
          const err = mapCurvetError(res.status, body);
          status = { ...base, ready: res.status !== 401 && res.status !== 403, detail: err.message, fix: res.status === 401 ? ["Create a new key in Curvet → API Keys (with the Image category on) and update CURVET_API_KEY."] : [] };
        }
      } catch {
        // Can't reach Curvet right now: say so, but don't block requests — the request itself will report clearly.
        status = { ...base, ready: true, detail: "A Curvet key is set up, but Curvet couldn’t be reached just now to check the balance.", fix: [] };
      }
    }
    this.cached = { at: Date.now(), status };
    return status;
  }

  async generateImage(request: GenerateImageRequest, signal: AbortSignal): Promise<RawProviderImage> {
    const body = JSON.stringify({ model: this.model("generate"), prompt: request.prompt, size: SIZES[request.options.aspect] });
    return this.call({ method: "POST", headers: { ...this.headers(), "content-type": "application/json" }, body }, signal);
  }

  async editImage(request: EditImageRequest, signal: AbortSignal): Promise<RawProviderImage> {
    const form = new FormData();
    form.set("model", this.model("edit"));
    form.set("prompt", request.prompt);
    form.set("size", closestSize(request.image.width, request.image.height));
    const ext = request.image.format === "jpeg" ? "jpg" : request.image.format;
    form.append("image", new Blob([new Uint8Array(request.image.bytes)], { type: `image/${request.image.format}` }), `source.${ext}`);
    return this.call({ method: "POST", headers: this.headers(), body: form }, signal);
  }

  private async call(init: RequestInit, signal: AbortSignal): Promise<RawProviderImage> {
    if (!this.key()) throw new ProviderError("not_configured", "No Curvet API key is set up on the server yet.", { retryable: false });
    const timeout = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
    const both = AbortSignal.any([signal, timeout]);
    let res: Response;
    try {
      res = await this.fetchImpl(`${curvetBaseUrl()}/image`, { ...init, signal: both });
    } catch (e) {
      if (signal.aborted) throw new ProviderError("interrupted", "This request was cancelled.", { retryable: true });
      if (timeout.aborted) throw new ProviderError("timeout", "The image service took too long. Try again.");
      throw new ProviderError("unavailable", "The image service can’t be reached right now. Try again.", { detail: String(e) });
    }
    const json = (await res.json().catch(() => null)) as ({ success?: boolean; imageUrl?: string; data?: { b64_json?: string; url?: string }[] } & CurvetErrorBody) | null;
    if (!res.ok || json?.success === false) throw mapCurvetError(res.ok ? 400 : res.status, json);
    const b64 = json?.data?.[0]?.b64_json;
    if (b64) return { bytes: Buffer.from(b64, "base64") };
    const url = json?.imageUrl ?? json?.data?.[0]?.url;
    if (!url) throw new ProviderError("provider_error", "The image service replied without an image. Try again.");
    return { bytes: await this.download(url, both) };
  }

  /** The result link may expire, so the bytes are fetched at once and kept in the studio's own storage. */
  private async download(url: string, signal: AbortSignal): Promise<Buffer> {
    if (url.startsWith("data:")) return Buffer.from(url.slice(url.indexOf(",") + 1), "base64");
    let res: Response;
    try {
      res = await this.fetchImpl(url, { signal });
    } catch (e) {
      throw new ProviderError("unavailable", "The image was made but couldn’t be downloaded. Try again.", { detail: String(e) });
    }
    if (!res.ok) throw new ProviderError("provider_error", "The image was made but couldn’t be downloaded. Try again.", { detail: `HTTP ${res.status} for result` });
    return Buffer.from(await res.arrayBuffer());
  }
}

/** A setting from the environment, or on a Mac from a private file in ~/.config/arnifi-image-studio/. */
function secret(envName: string, fileName: string): string | null {
  const fromEnv = process.env[envName]?.trim();
  if (fromEnv) return fromEnv;
  if (process.env.VERCEL === "1" || process.env.STUDIO_TEST_MODE === "1") return null;
  try {
    return readFileSync(/*turbopackIgnore: true*/ join(homedir(), ".config", "arnifi-image-studio", fileName), "utf8").trim() || null;
  } catch {
    return null;
  }
}

/** Edits keep the source's shape: the nearest of the sizes GPT Image produces. */
export function closestSize(width: number, height: number): string {
  const r = width / height;
  if (r > 1.2) return SIZES.landscape;
  if (r < 0.83) return SIZES.portrait;
  return SIZES.square;
}

/** Curvet reports { totalAvailableUSD, walletBalance, … }; shown as "US$42.63". */
export function formatBalance(value: unknown): string | null {
  const usd = (n: number) => `US$${n.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (typeof value === "number") return usd(value);
  if (value && typeof value === "object") {
    const v = value as Record<string, unknown>;
    const n = [v.totalAvailableUSD, v.walletBalance, v.available, v.balance].find((x) => typeof x === "number") as number | undefined;
    if (n !== undefined) return usd(n);
  }
  return null;
}

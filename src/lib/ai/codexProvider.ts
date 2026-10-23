import "server-only";
import { copyFile, mkdtemp, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import sharp from "sharp";
import type { AspectRatio } from "@/types/generation";
import { findBin, run, type RunResult } from "./exec";
import { ProviderError, type EditImageRequest, type GenerateImageRequest, type ImageProvider, type ProviderStatus, type RawProviderImage, type SupportedOptions } from "./imageProvider";

/*
 * ChatGPT through the official Codex CLI, signed in with the person's ChatGPT plan (the user's choice over an API key).
 * Generation and editing use Codex's built-in image tool — the invocation proven in Creative Studio and the relight
 * scripts: `codex exec … -s workspace-write -C <tmp> "<instruction + prompt>" [-i image]`, stdin closed.
 *
 * `--ignore-user-config` runs Codex without the person's own ~/.codex/config.toml — no MCP servers, plugins, skills or
 * hooks (the sign-in is still used). Those add-ons made runs slow and sometimes hung after the image was already made.
 *
 * What it can't do, said honestly in getSupportedOptions(): the shape is requested in words (ChatGPT picks the final
 * size), there's no quality or transparency setting, and it works only on the computer where Codex is signed in.
 */

const DEFAULT_MODEL = "gpt-5.6-terra";
const IMAGE_TIMEOUT_MS = 10 * 60_000;

const ASPECT_WORDS: Record<AspectRatio, string> = {
  square: "a square format (1:1, for example 1024 × 1024)",
  portrait: "a portrait format (2:3, for example 1024 × 1536)",
  landscape: "a landscape format (3:2, for example 1536 × 1024)",
};

export function codexModel(): string {
  return process.env.CODEX_MODEL?.trim() || DEFAULT_MODEL;
}

/** Optional: send Codex to another backend (CODEX_BASE_URL). By default it talks to ChatGPT directly. */
function baseUrlArgs(): string[] {
  const value = process.env.CODEX_BASE_URL?.trim();
  return value ? ["-c", `openai_base_url=${JSON.stringify(value)}`] : [];
}

function baseArgs(): string[] {
  return ["exec", "--ignore-user-config", "--ignore-rules", "-c", "model_reasoning_effort=low", "--skip-git-repo-check", "--ephemeral", ...baseUrlArgs(), "-m", codexModel()];
}

/** Reads a usage-limit message and its reset time, if Codex printed one. */
export function parseUsageLimit(text: string, now = new Date()): { limited: boolean; resetAt: string | null } {
  const limited = /usage limit|rate.?limit|\b429\b|too many requests|cooling down|quota|limit reached|try again (at|in)/i.test(text);
  if (!limited) return { limited: false, resetAt: null };
  const at = text.match(/try again at\s+(\d{1,2}):(\d{2})\s*(am|pm)?/i);
  if (at) {
    let h = Number(at[1]) % 12;
    if ((at[3] ?? "").toLowerCase() === "pm") h += 12;
    if (!at[3] && Number(at[1]) >= 13) h = Number(at[1]);
    const d = new Date(now);
    d.setHours(h, Number(at[2]), 0, 0);
    if (d < now) d.setDate(d.getDate() + 1);
    return { limited: true, resetAt: d.toISOString() };
  }
  const inMin = text.match(/try again in\s+(\d+)\s*(minute|min|hour|h)/i);
  if (inMin) {
    const minutes = Number(inMin[1]) * (/h/i.test(inMin[2]) ? 60 : 1);
    return { limited: true, resetAt: new Date(now.getTime() + minutes * 60_000).toISOString() };
  }
  return { limited: true, resetAt: null };
}

/** Maps a failed Codex run to a plain-language error (PRD §21.5). Exported for tests. */
export function classifyCodexFailure(
  result: Pick<RunResult, "code" | "stdout" | "stderr" | "timedOut" | "aborted">,
  sent = "",
  lastMessage = "",
): ProviderError {
  // Codex echoes the prompt into its log; remove it so words in the person's brief can't be mistaken for an error.
  const log = sent ? `${result.stdout}\n${result.stderr}`.split(sent).join("") : `${result.stdout}\n${result.stderr}`;
  const text = `${log}\n${lastMessage}`;
  if (result.aborted) return new ProviderError("interrupted", "This request was cancelled.", { retryable: true });
  if (result.timedOut) return new ProviderError("timeout", "ChatGPT took too long to make this image. Try again.");
  if (/ENOENT|command not found|no such file or directory.*codex/i.test(text) && result.code === -1) {
    return new ProviderError("not_configured", "The Codex app isn’t installed on this computer, so ChatGPT can’t make images yet.", { retryable: false });
  }
  if (/model is not supported|not supported when using codex|model_not_found|unknown model|does not exist/i.test(text)) {
    return new ProviderError("not_configured", `The model “${codexModel()}” isn’t available on this ChatGPT plan. Choose another one in Settings.`, { retryable: false });
  }
  if (/not logged in|login required|please (log|sign) in|run `?codex login|unauthori[sz]ed|\b401\b|token (has )?expired|refresh token/i.test(text)) {
    return new ProviderError("not_signed_in", "Codex isn’t signed in to ChatGPT on this computer.", { retryable: false });
  }
  const limit = parseUsageLimit(text);
  if (limit.limited) {
    return new ProviderError("usage_limit", "Your ChatGPT plan has reached its image limit for now.", { resetAt: limit.resetAt });
  }
  if (/content policy|safety (system|policy)|moderation|violat|not allowed to (create|generate)|can(?:'|’)t (help|create|generate|make) (with )?(that|this)|unable to (create|generate) (that|this)/i.test(text) || /^\s*(i(?:'|’)m sorry|sorry)/i.test(lastMessage)) {
    return new ProviderError("content_refused", "ChatGPT declined this request under its content rules. Try describing it differently.", { retryable: false });
  }
  if (/image generation (is )?(not|un)available|don(?:'|’)t have (access to )?(an )?image|cannot generate images|no image (generation )?tool/i.test(text)) {
    return new ProviderError("capability", "Image generation isn’t available on this ChatGPT connection.", { retryable: false });
  }
  if (/ENOTFOUND|ECONNREFUSED|ECONNRESET|network|stream disconnected|\b50[234]\b|service unavailable|overloaded/i.test(text)) {
    return new ProviderError("unavailable", "ChatGPT can’t be reached right now. Check the internet connection and try again.");
  }
  return new ProviderError("provider_error", "ChatGPT didn’t return an image this time. Try again.", { detail: text.slice(-800) });
}

/** The image tool saves into ~/.codex/generated_images and the agent copies it; find it if the copy didn't happen. */
export function findGeneratedImagePath(stdout: string): string | null {
  const root = resolve(homedir(), ".codex", "generated_images") + sep;
  const matches = stdout.match(/\/[^\s'"`]*\/\.codex\/generated_images\/[^\s'"`]+\.(?:png|jpe?g|webp)/gi) ?? [];
  for (const m of matches.reverse()) {
    const full = resolve(m);
    if (full.startsWith(root)) return full;
  }
  return null;
}

export class CodexProvider implements ImageProvider {
  readonly id = "codex";
  readonly label = "ChatGPT (via Codex)";
  private readonly bin = findBin("codex");
  private cached: { at: number; status: ProviderStatus } | null = null;

  model(): string {
    return codexModel();
  }

  getSupportedOptions(): SupportedOptions {
    return {
      aspect: {
        values: ["square", "portrait", "landscape"],
        exact: false,
        note: "ChatGPT is asked for this shape. It picks the final size, which is shown with the result.",
      },
      quality: { supported: false, values: [], note: "Not available with the ChatGPT connection — ChatGPT sets the quality." },
      background: { supported: false, values: ["normal"], note: "Transparent backgrounds aren’t available with the ChatGPT connection." },
      maxOutputs: 1,
      edit: { supported: true, note: null },
    };
  }

  async status(force = false): Promise<ProviderStatus> {
    if (!force && this.cached && Date.now() - this.cached.at < 60_000) return this.cached.status;
    const checkedAt = new Date().toISOString();
    const base = { id: this.id, label: this.label, model: this.model(), checkedAt };
    const version = await run(this.bin, ["--version"], { timeoutMs: 20_000 });
    let status: ProviderStatus;
    if (version.code !== 0) {
      status = {
        ...base,
        ready: false,
        detail: "The Codex app isn’t installed on this computer.",
        fix: ["Open Terminal.", "Run: npm install -g @openai/codex", "Then run: codex login — and choose “Sign in with ChatGPT”.", "Come back here and press Check Again."],
      };
    } else {
      const login = await run(this.bin, ["login", "status"], { timeoutMs: 30_000 });
      const out = `${login.stdout}\n${login.stderr}`;
      if (/logged in using chatgpt/i.test(out)) {
        status = { ...base, ready: true, detail: `Signed in with your ChatGPT plan (${version.stdout.trim()}). Images take about 1–2 minutes.`, fix: [] };
      } else if (/api key/i.test(out)) {
        status = {
          ...base,
          ready: true,
          detail: "Codex is signed in with an API key, so images are billed to that OpenAI account instead of your ChatGPT plan.",
          fix: ["To use your ChatGPT plan instead, run: codex logout, then codex login and choose “Sign in with ChatGPT”."],
        };
      } else {
        status = {
          ...base,
          ready: false,
          detail: "Codex is installed but not signed in to ChatGPT.",
          fix: ["Open Terminal.", "Run: codex login — and choose “Sign in with ChatGPT”.", "Come back here and press Check Again."],
        };
      }
    }
    this.cached = { at: Date.now(), status };
    return status;
  }

  async generateImage(request: GenerateImageRequest, signal: AbortSignal): Promise<RawProviderImage> {
    const instruction =
      `Use your built-in image generation tool (do not draw with code, do not write scripts, do not search the web) to generate exactly ONE image in ${ASPECT_WORDS[request.options.aspect]} from the brief below. ` +
      "Follow the brief faithfully; do not add anything it doesn't ask for.";
    return this.runImage(instruction, request.prompt, null, signal);
  }

  async editImage(request: EditImageRequest, signal: AbortSignal): Promise<RawProviderImage> {
    const instruction =
      "Use your built-in image generation tool in EDIT mode on the attached image (do not draw with code, do not write scripts). " +
      "Change only what the edit request asks; keep the composition, camera angle, framing and aspect ratio otherwise.";
    return this.runImage(instruction, request.prompt, request.image, signal);
  }

  private async runImage(instruction: string, prompt: string, image: EditImageRequest["image"] | null, signal: AbortSignal): Promise<RawProviderImage> {
    const dir = await mkdtemp(join(tmpdir(), "image-studio-codex-"));
    const target = join(dir, "result.png");
    const lastMessageFile = join(dir, "last-message.txt");
    try {
      const sent = `${instruction} Then copy the resulting PNG file to ${target} and stop.\n\n${prompt}`;
      const args = [...baseArgs(), "-s", "workspace-write", "-C", dir, "-o", lastMessageFile, sent];
      if (image) {
        // Codex reads PNG and JPEG attachments reliably; WebP is converted to PNG first (pixels unchanged).
        const source = join(dir, image.format === "jpeg" ? "source.jpg" : "source.png");
        await writeFile(source, image.format === "webp" ? await sharp(image.bytes).png().toBuffer() : image.bytes);
        args.push("-i", source); // -i goes after the prompt
      }
      // As soon as the finished PNG is in place, stop waiting — even if Codex lingers afterwards.
      const result = await run(this.bin, args, { cwd: dir, timeoutMs: IMAGE_TIMEOUT_MS, signal, doneWhen: () => isStableFile(target) });
      const found = await this.collect(dir, target, result.stdout);
      if (found) return { bytes: found };
      const lastMessage = await readFile(lastMessageFile, "utf8").catch(() => "");
      throw classifyCodexFailure(result, sent, lastMessage);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  }

  private async collect(dir: string, target: string, stdout: string): Promise<Buffer | null> {
    if (await nonEmpty(target)) return readFile(target);
    const stray = (await readdir(dir)).filter((f) => /\.(png|jpe?g|webp)$/i.test(f) && !/^(source|result)\./.test(f));
    if (stray.length) return readFile(join(dir, stray[0]));
    const generated = findGeneratedImagePath(stdout);
    if (generated && (await nonEmpty(generated))) {
      await copyFile(generated, target);
      return readFile(target);
    }
    return null;
  }
}

const sizes = new Map<string, number>();

/** True once the file exists, is non-empty and hasn't grown since the last check (the copy has finished). */
async function isStableFile(path: string): Promise<boolean> {
  try {
    const size = (await stat(path)).size;
    const before = sizes.get(path);
    sizes.set(path, size);
    if (size > 0 && before === size) {
      sizes.delete(path);
      return true;
    }
  } catch {
    /* not there yet */
  }
  return false;
}

async function nonEmpty(path: string): Promise<boolean> {
  try {
    return (await stat(path)).size > 0;
  } catch {
    return false;
  }
}

import "server-only";
import sharp from "sharp";
import type { AspectRatio } from "@/types/generation";
import { ProviderError, type EditImageRequest, type GenerateImageRequest, type ImageProvider, type ProviderStatus, type RawProviderImage, type SupportedOptions } from "./imageProvider";

/*
 * Automated tests only (PRD §25: mocked provider responses, no paid calls). It can only be switched on with
 * STUDIO_TEST_MODE=1, and the header shows a "Test provider" badge whenever it is active, so its pictures can never pass
 * for real AI results. A prompt containing a [[fail:<code>]] marker makes it fail that way, for error-state tests.
 */

const SIZES: Record<AspectRatio, [number, number]> = { square: [256, 256], portrait: [256, 384], landscape: [384, 256] };

export class MockProvider implements ImageProvider {
  readonly id = "mock";
  readonly label = "Test provider";

  model(): string {
    return "test-image-model";
  }

  getSupportedOptions(): SupportedOptions {
    return {
      aspect: { values: ["square", "portrait", "landscape"], exact: true, note: null },
      quality: { supported: true, values: ["standard", "high"], note: null },
      background: { supported: true, values: ["normal", "transparent"], note: null },
      maxOutputs: 1,
      edit: { supported: true, note: null },
    };
  }

  async status(): Promise<ProviderStatus> {
    return {
      id: this.id,
      label: this.label,
      model: this.model(),
      ready: process.env.MOCK_PROVIDER_READY !== "0",
      detail: "Automated-test provider. Its images are plain test patterns, not AI results.",
      fix: [],
      checkedAt: new Date().toISOString(),
    };
  }

  async generateImage(request: GenerateImageRequest, signal: AbortSignal): Promise<RawProviderImage> {
    await this.wait(signal);
    this.maybeFail(request.prompt);
    const [w, h] = SIZES[request.options.aspect];
    const transparent = request.options.background === "transparent";
    const bytes = await sharp({
      create: { width: w, height: h, channels: 4, background: transparent ? { r: 46, g: 46, b: 163, alpha: 0 } : { r: 46, g: 46, b: 163, alpha: 1 } },
    })
      .composite([{ input: Buffer.from(svgMark(w, h, "TEST")), top: 0, left: 0 }])
      .png()
      .toBuffer();
    return { bytes };
  }

  async editImage(request: EditImageRequest, signal: AbortSignal): Promise<RawProviderImage> {
    await this.wait(signal);
    this.maybeFail(request.prompt);
    const { width, height } = request.image;
    const bytes = await sharp(request.image.bytes).rotate().modulate({ brightness: 1.25 }).composite([{ input: Buffer.from(svgMark(width, height, "EDIT")), top: 0, left: 0 }]).png().toBuffer();
    return { bytes };
  }

  private async wait(signal: AbortSignal) {
    const ms = Number(process.env.MOCK_PROVIDER_DELAY_MS ?? 600);
    await new Promise<void>((resolve, reject) => {
      const t = setTimeout(resolve, ms);
      signal.addEventListener("abort", () => {
        clearTimeout(t);
        reject(new ProviderError("interrupted", "This request was cancelled.", { retryable: true }));
      });
    });
  }

  private maybeFail(prompt: string) {
    const m = prompt.match(/\[\[fail:([a-z_]+)\]\]/);
    if (!m) return;
    const code = m[1] as ProviderError["code"];
    const messages: Partial<Record<ProviderError["code"], string>> = {
      content_refused: "The image service declined this request under its content rules. Try describing it differently.",
      usage_limit: "The Curvet account has run out of credits. Top up the balance in Curvet, then try again.",
      unavailable: "The image service can’t be reached right now. Try again.",
    };
    throw new ProviderError(code, messages[code] ?? "The test provider failed on purpose.");
  }
}

function svgMark(w: number, h: number, label: string): string {
  const size = Math.round(Math.min(w, h) / 5);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect x="8" y="8" width="${w - 16}" height="${h - 16}" fill="none" stroke="white" stroke-width="4"/><text x="50%" y="50%" fill="white" font-family="sans-serif" font-size="${size}" text-anchor="middle" dominant-baseline="middle">${label}</text></svg>`;
}

import sharp from "sharp";
import { describe, expect, it, vi } from "vitest";
import { classifyCodexFailure, findGeneratedImagePath, parseUsageLimit } from "@/lib/ai/codexProvider";
import { handleProviderError, ProviderError } from "@/lib/ai/imageProvider";
import { normalizeImageResult, shapeOf } from "@/lib/ai/normalize";
import { mapOpenAIError, OpenAIProvider } from "@/lib/ai/openaiProvider";
import { effectiveOptions, RequestError } from "@/lib/server/compose";
import { CodexProvider } from "@/lib/ai/codexProvider";

const run = (stdout: string, extra: Partial<{ code: number; stderr: string; timedOut: boolean; aborted: boolean }> = {}) => ({ code: 1, stdout, stderr: "", timedOut: false, aborted: false, ...extra });

describe("Codex failures become plain, honest errors (PRD §21.5)", () => {
  it("usage limits, with the reset time when given", () => {
    const now = new Date("2026-10-23T15:00:00");
    const limit = parseUsageLimit("You've hit your usage limit. Try again at 4:55 PM.", now);
    expect(limit.limited).toBe(true);
    expect(new Date(limit.resetAt!).getHours()).toBe(16);
    expect(classifyCodexFailure(run("ERROR: Selected Codex account is cooling down (429)")).code).toBe("usage_limit");
  });

  it("sign-in, unsupported model, refusal, network, timeout and cancel", () => {
    expect(classifyCodexFailure(run("Error: Not logged in. Run codex login")).code).toBe("not_signed_in");
    expect(classifyCodexFailure(run(`{"message":"The 'gpt-5.5' model is not supported when using Codex with a ChatGPT account."}`)).code).toBe("not_configured");
    expect(classifyCodexFailure(run("", { stderr: "" }), "", "I’m sorry, but I can’t create that image.").code).toBe("content_refused");
    expect(classifyCodexFailure(run("stream disconnected before completion: ECONNRESET")).code).toBe("unavailable");
    expect(classifyCodexFailure(run("", { timedOut: true })).code).toBe("timeout");
    expect(classifyCodexFailure(run("", { aborted: true })).code).toBe("interrupted");
    expect(classifyCodexFailure(run("something odd")).code).toBe("provider_error");
  });

  it("ignores words from the person's own brief that Codex echoes back", () => {
    const sent = "Brief: an office poster about our usage limit and quota policy";
    expect(classifyCodexFailure(run(`user\n${sent}\ncodex\nDone.`), sent).code).toBe("provider_error");
  });

  it("finds the image the tool saved when the agent didn't copy it", () => {
    const home = process.env.HOME!;
    const p = `${home}/.codex/generated_images/abc/exec-1.png`;
    expect(findGeneratedImagePath(`cp ${p} /tmp/out.png`)).toBe(p);
    expect(findGeneratedImagePath("cp /etc/passwd.png /tmp")).toBeNull();
  });

  it("is honest about what the ChatGPT connection supports", () => {
    const o = new CodexProvider().getSupportedOptions();
    expect(o.aspect.exact).toBe(false);
    expect(o.quality.supported).toBe(false);
    expect(o.background.supported).toBe(false);
    expect(() => effectiveOptions({ aspect: "square", quality: "standard", background: "transparent" }, o)).toThrow(RequestError);
    expect(effectiveOptions({ aspect: "portrait", quality: "standard", background: "normal" }, o)).toEqual({ aspect: "portrait", quality: "standard", background: "normal" });
  });
});

describe("OpenAI Image API provider (mocked — no paid calls)", () => {
  it("sends the documented parameters and decodes b64_json", async () => {
    process.env.OPENAI_API_KEY = "test-key";
    const png = await sharp({ create: { width: 64, height: 64, channels: 3, background: "#2e2ea3" } }).png().toBuffer();
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ data: [{ b64_json: png.toString("base64") }] }), { status: 200 }));
    const provider = new OpenAIProvider(fetchMock as unknown as typeof fetch);
    const out = await provider.generateImage({ prompt: "p", options: { aspect: "portrait", quality: "high", background: "transparent" } }, new AbortController().signal);
    expect(out.bytes.equals(png)).toBe(true);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.openai.com/v1/images/generations");
    expect(JSON.parse(init.body as string)).toMatchObject({ model: "gpt-image-2.5-flare", size: "1024x1536", quality: "high", background: "transparent", output_format: "png" });
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer test-key");
    delete process.env.OPENAI_API_KEY;
  });

  it("maps API errors to plain messages", () => {
    expect(mapOpenAIError(400, { error: { code: "moderation_blocked", message: "blocked" } }).code).toBe("content_refused");
    expect(mapOpenAIError(401, null).code).toBe("not_configured");
    expect(mapOpenAIError(429, { error: { message: "You exceeded your current quota" } }).code).toBe("usage_limit");
    expect(mapOpenAIError(429, { error: { message: "Rate limit" } }).code).toBe("rate_limited");
    expect(mapOpenAIError(503, null).code).toBe("unavailable");
  });

  it("refuses to run without a key instead of failing silently", async () => {
    delete process.env.OPENAI_API_KEY;
    await expect(new OpenAIProvider().generateImage({ prompt: "p", options: { aspect: "square", quality: "standard", background: "normal" } }, new AbortController().signal)).rejects.toMatchObject({ code: "not_configured" });
  });
});

describe("normalizeImageResult (PRD §14.3)", () => {
  it("accepts only real images and notes a shape mismatch honestly", async () => {
    const square = await sharp({ create: { width: 128, height: 128, channels: 3, background: "#fff" } }).png().toBuffer();
    const r = await normalizeImageResult({ bytes: square }, { aspect: "landscape" });
    expect(r).toMatchObject({ width: 128, height: 128, format: "png" });
    expect(r.warnings[0]).toMatch(/asked for landscape, but the image came back square/);
    await expect(normalizeImageResult({ bytes: Buffer.from("not an image") })).rejects.toBeInstanceOf(ProviderError);
    expect(shapeOf(1536, 1024)).toBe("landscape");
    expect(shapeOf(1024, 1536)).toBe("portrait");
  });

  it("unknown errors never leak internals", () => {
    const e = handleProviderError(new Error("ECONNRESET at internal/stack.js:1"));
    expect(e.message).not.toMatch(/stack/);
    expect(e.retryable).toBe(true);
  });
});

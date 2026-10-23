import sharp from "sharp";
import { afterEach, describe, expect, it, vi } from "vitest";
import { closestSize, CurvetProvider, mapCurvetError } from "@/lib/ai/curvetProvider";
import { handleProviderError, ProviderError } from "@/lib/ai/imageProvider";
import { normalizeImageResult, shapeOf } from "@/lib/ai/normalize";
import { effectiveOptions, RequestError } from "@/lib/server/compose";

const okImage = async () => sharp({ create: { width: 64, height: 64, channels: 3, background: "#2e2ea3" } }).png().toBuffer();

function fakeFetch(handler: (url: string, init: RequestInit) => Response | Promise<Response>) {
  return vi.fn(async (url: string | URL | Request, init: RequestInit = {}) => handler(String(url), init));
}

describe("Curvet provider (mocked — no credits spent)", () => {
  afterEach(() => {
    delete process.env.CURVET_API_KEY;
    delete process.env.CURVET_IMAGE_MODEL;
    delete process.env.CURVET_EDIT_MODEL;
  });

  it("generates with the GPT image model: POST /image, x-app-key, exact size, then downloads the result", async () => {
    process.env.CURVET_API_KEY = "cvt_test_key";
    const png = await okImage();
    const fetchMock = fakeFetch((url) =>
      url.endsWith("/image")
        ? new Response(JSON.stringify({ success: true, imageUrl: "https://cdn.example/result.png", usage: {}, metadata: { model: "gpt-image-2" } }), { status: 200 })
        : new Response(new Uint8Array(png), { status: 200 }),
    );
    const provider = new CurvetProvider(fetchMock as unknown as typeof fetch);
    const out = await provider.generateImage({ prompt: "Dubai office", options: { aspect: "portrait", quality: "standard", background: "normal" } }, new AbortController().signal);
    expect(out.bytes.equals(png)).toBe(true);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://curvet.ai/api/v1/playground/image");
    expect((init.headers as Record<string, string>)["x-app-key"]).toBe("cvt_test_key");
    expect(JSON.parse(init.body as string)).toEqual({ model: "gpt-image-2.5-flare", prompt: "Dubai office", size: "1024x1536" });
    expect(fetchMock.mock.calls[1][0]).toBe("https://cdn.example/result.png");
  });

  it("edits with the same model, sending the source photo as `image`, keeping its shape", async () => {
    process.env.CURVET_API_KEY = "cvt_test_key";
    const png = await okImage();
    const fetchMock = fakeFetch((url) => (url.endsWith("/image") ? new Response(JSON.stringify({ success: true, imageUrl: "data:image/png;base64," + png.toString("base64") }), { status: 200 }) : new Response("", { status: 404 })));
    const provider = new CurvetProvider(fetchMock as unknown as typeof fetch);
    const out = await provider.editImage({ prompt: "Brighter", image: { bytes: png, format: "png", width: 1600, height: 900 } }, new AbortController().signal);
    expect(out.bytes.equals(png)).toBe(true);
    const form = (fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body as FormData;
    expect(form.get("model")).toBe("gpt-image-2.5-flare");
    expect(form.get("prompt")).toBe("Brighter");
    expect(form.get("size")).toBe("1536x1024");
    expect(form.get("image")).toBeInstanceOf(Blob);
    expect(closestSize(900, 1600)).toBe("1024x1536");
    expect(closestSize(1000, 1000)).toBe("1024x1024");
  });

  it("maps Curvet errors to plain messages", () => {
    expect(mapCurvetError(401, { error: "Invalid app key" }).code).toBe("not_configured");
    expect(mapCurvetError(403, { error: "category not allowed" }).message).toMatch(/Image category/);
    expect(mapCurvetError(402, { error: "Insufficient balance", required: 5, available: 1 }).code).toBe("usage_limit");
    expect(mapCurvetError(429, { error: "rate limited", resetsAt: "2026-10-23T12:00:00Z" })).toMatchObject({ code: "rate_limited", resetAt: "2026-10-23T12:00:00Z" });
    expect(mapCurvetError(400, { error: "Your request was rejected by the safety system" }).code).toBe("content_refused");
    expect(mapCurvetError(400, { error: "unknown model" }).code).toBe("invalid_request");
    expect(mapCurvetError(502, null).code).toBe("unavailable");
  });

  it("says clearly when no key is set, and reports the balance when one is", async () => {
    const none = new CurvetProvider(fakeFetch(() => new Response("{}")) as unknown as typeof fetch);
    expect(await none.status(true)).toMatchObject({ ready: false, detail: expect.stringMatching(/No Curvet API key/) });
    await expect(none.generateImage({ prompt: "p", options: { aspect: "square", quality: "standard", background: "normal" } }, new AbortController().signal)).rejects.toMatchObject({ code: "not_configured" });
    process.env.CURVET_API_KEY = "cvt_test_key";
    const ok = new CurvetProvider(fakeFetch(() => new Response(JSON.stringify({ success: true, balance: { walletBalance: 41.6, totalAvailableUSD: 42.6316 } }), { status: 200 })) as unknown as typeof fetch);
    expect(await ok.status(true)).toMatchObject({ ready: true, detail: expect.stringMatching(/Images and edits use gpt-image-2\.5-flare · balance US\$42\.63/) });
    const bad = new CurvetProvider(fakeFetch(() => new Response(JSON.stringify({ error: "Invalid app key" }), { status: 401 })) as unknown as typeof fetch);
    expect(await bad.status(true)).toMatchObject({ ready: false, detail: expect.stringMatching(/rejected/) });
  });

  it("is honest about the options it supports, and the server enforces it", () => {
    const o = new CurvetProvider().getSupportedOptions();
    expect(o.aspect.exact).toBe(true);
    expect(o.background.supported).toBe(false);
    expect(o.edit.note).toMatch(/redraws the picture/);
    expect(() => effectiveOptions({ aspect: "square", quality: "standard", background: "transparent" }, o)).toThrow(RequestError);
    expect(effectiveOptions({ aspect: "portrait", quality: "standard", background: "normal" }, o)).toEqual({ aspect: "portrait", quality: "standard", background: "normal" });
  });

  it("never fails silently when Curvet replies without an image", async () => {
    process.env.CURVET_API_KEY = "cvt_test_key";
    const provider = new CurvetProvider(fakeFetch(() => new Response(JSON.stringify({ success: true }), { status: 200 })) as unknown as typeof fetch);
    await expect(provider.generateImage({ prompt: "p", options: { aspect: "square", quality: "standard", background: "normal" } }, new AbortController().signal)).rejects.toBeInstanceOf(ProviderError);
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

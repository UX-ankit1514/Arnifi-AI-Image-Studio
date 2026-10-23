import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { NextRequest } from "next/server";
import sharp from "sharp";
import { resetImageStore } from "@/lib/database/imageRepository";
import { resetTemplateCache } from "@/lib/database/templateRepository";
import { resetUsage } from "@/lib/security/rateLimit";
import type { JobView } from "@/types/generation";

/* Integration helpers: call the real route handlers against the Firestore emulator, with the test provider. */

process.env.STUDIO_DATA_DIR = mkdtempSync(join(tmpdir(), "image-studio-it-"));
process.env.MOCK_PROVIDER_DELAY_MS = "30";

export const SESSION = "11111111-2222-3333-4444-555555555555";
const BASE = "http://127.0.0.1:3109";

export async function resetAll() {
  const host = process.env.FIRESTORE_EMULATOR_HOST;
  if (!host) throw new Error("Run integration tests with `npm run test:integration` (needs the Firestore emulator).");
  await fetch(`http://${host}/emulator/v1/projects/${process.env.FIREBASE_PROJECT_ID}/databases/(default)/documents`, { method: "DELETE" });
  resetImageStore();
  resetTemplateCache();
  resetUsage();
  (globalThis as { __jobRunner?: unknown }).__jobRunner = undefined;
}

export function req(path: string, init: { method?: string; json?: unknown; form?: FormData; session?: string | null } = {}) {
  const headers = new Headers();
  if (init.session !== null) headers.set("cookie", `studio_sid=${init.session ?? SESSION}`);
  let body: BodyInit | undefined;
  if (init.json !== undefined) {
    headers.set("content-type", "application/json");
    body = JSON.stringify(init.json);
  } else if (init.form) body = init.form;
  return new NextRequest(`${BASE}${path}`, { method: init.method ?? (body ? "POST" : "GET"), headers, body });
}

export const ctx = <T extends Record<string, string>>(params: T) => ({ params: Promise.resolve(params) }) as never;

export async function png(w = 320, h = 200, alpha = 1, color = { r: 46, g: 46, b: 163 }) {
  return sharp({ create: { width: w, height: h, channels: 4, background: { ...color, alpha } } }).png().toBuffer();
}

export function fileForm(bytes: Buffer, name: string, fields: Record<string, string> = {}) {
  const form = new FormData();
  form.set("file", new File([new Uint8Array(bytes)], name, { type: name.endsWith(".gif") ? "image/gif" : "image/png" }));
  for (const [k, v] of Object.entries(fields)) form.set(k, v);
  return form;
}

export async function waitForJob(get: (id: string) => Promise<JobView | null>, id: string, ms = 10_000): Promise<JobView> {
  const start = Date.now();
  for (;;) {
    const job = await get(id);
    if (job && ["completed", "failed", "cancelled"].includes(job.status)) return job;
    if (Date.now() - start > ms) throw new Error(`job ${id} did not finish (status ${job?.status})`);
    await new Promise((r) => setTimeout(r, 25));
  }
}

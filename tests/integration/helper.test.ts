import { NextRequest } from "next/server";
import sharp from "sharp";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { GET as getDraftFile } from "@/app/api/drafts/[id]/file/route";
import { POST as saveDraft } from "@/app/api/drafts/[id]/save/route";
import { POST as postEdit } from "@/app/api/edit/route";
import { POST as postGenerate } from "@/app/api/generate/route";
import { GET as listImages } from "@/app/api/images/route";
import { DELETE as cancelJob, GET as getJob } from "@/app/api/jobs/[id]/route";
import { POST as completeUpload } from "@/app/api/uploads/[id]/complete/route";
import { PUT as putPart } from "@/app/api/uploads/[id]/parts/[n]/route";
import { POST as startUpload } from "@/app/api/uploads/route";
import { GET as getStatus } from "@/app/api/status/route";
import { MockProvider } from "@/lib/ai/mockProvider";
import { getDb } from "@/lib/database/firestore";
import { FirestoreImageStore } from "@/lib/database/imageRepository";
import { HelperWorker } from "@/lib/helper/worker";
import type { DraftInfo, JobView } from "@/types/generation";
import type { ImageRecord, LibraryListing } from "@/types/image";
import type { StudioStatus } from "@/types/status";
import { ctx, png, req, resetAll, SESSION, waitForJob } from "./helpers";

/*
 * The live-site setup (helper mode): the website only queues requests in Firestore; a helper (here with the test
 * provider instead of Codex) picks them up and writes results back. Same journeys as on a Mac, across "machines".
 */

let worker: HelperWorker | null = null;

async function startHelper() {
  worker = new HelperWorker(getDb(), new MockProvider(), { helperId: "mac-test", hostname: "Test-Mac", heartbeatMs: 300 });
  await worker.start();
}

const jobVia = async (id: string) => {
  const res = await getJob(req(`/api/jobs/${id}`), ctx({ id }));
  return res.status === 200 ? ((await res.json()) as { job: JobView }).job : null;
};

async function generate(brief: string) {
  const res = await postGenerate(req("/api/generate", { json: { brief } }));
  return { res, body: (await res.json()) as { job: JobView; error?: { code: string; message: string } } };
}

beforeEach(async () => {
  process.env.IMAGE_PROVIDER = "helper";
  process.env.MOCK_PROVIDER_DELAY_MS = "30";
  process.env.MOCK_PROVIDER_READY = "1";
  await resetAll();
  (globalThis as { __imageProvider?: unknown }).__imageProvider = undefined;
});

afterEach(async () => {
  await worker?.stop();
  worker = null;
  process.env.IMAGE_PROVIDER = "mock";
  (globalThis as { __imageProvider?: unknown }).__imageProvider = undefined;
});

describe("live site + helper Mac", () => {
  it("says plainly that no helper has connected, and queues nothing", async () => {
    const status = (await (await getStatus(req("/api/status?refresh=1"))).json()) as StudioStatus;
    expect(status.mode).toBe("helper");
    expect(status.ai.ready).toBe(false);
    expect(status.ai.detail).toMatch(/No helper Mac has connected yet/);
    const { res, body } = await generate("Office");
    expect(res.status).toBe(503);
    expect(body.error!.message).toMatch(/helper/i);
  });

  it("generates through the helper, stores the result in Firestore, and saves it", async () => {
    await startHelper();
    const status = (await (await getStatus(req("/api/status?refresh=1"))).json()) as StudioStatus;
    expect(status.ai).toMatchObject({ ready: true, label: "ChatGPT (via the helper Mac)" });
    expect(status.ai.detail).toMatch(/Test-Mac/);

    const { res, body } = await generate("A founder in a Dubai office");
    expect(res.status).toBe(202);
    const done = await waitForJob(jobVia, body.job.id);
    expect(done).toMatchObject({ status: "completed", helperId: "mac-test" });
    expect((await getDb().collection("drafts").doc(done.output!.id).get()).exists).toBe(true);

    const file = await getDraftFile(req(`/api/drafts/${done.output!.id}/file`), ctx({ id: done.output!.id }));
    expect(file.headers.get("content-type")).toBe("image/png");

    const saveRes = await saveDraft(req(`/api/drafts/${done.output!.id}/save`, { json: { title: "Founder", category: "Campaigns", tags: [] } }), ctx({ id: done.output!.id }));
    const { image } = (await saveRes.json()) as { image: ImageRecord };
    expect(image).toMatchObject({ sourceType: "generated", provider: "helper", prompt: "A founder in a Dubai office" });

    // Edit the saved image through the helper too; it becomes v2 and the original stays.
    const edit = await postEdit(req("/api/edit", { json: { source: { kind: "image", id: image.id }, instruction: "Brighter" } }));
    const editJob = ((await edit.json()) as { job: JobView }).job;
    const edited = await waitForJob(jobVia, editJob.id);
    expect(edited.status).toBe("completed");
    const v2 = (await (await saveDraft(req(`/api/drafts/${edited.output!.id}/save`, { json: { title: "Founder (edited)", category: "Campaigns", tags: [] } }), ctx({ id: edited.output!.id }))).json()) as { image: ImageRecord };
    expect(v2.image).toMatchObject({ version: 2, parentImageId: image.id, sourceType: "edited" });
  });

  it("reports provider failures from the helper honestly", async () => {
    await startHelper();
    const { body } = await generate("Nope [[fail:content_refused]]");
    const done = await waitForJob(jobVia, body.job.id);
    expect(done).toMatchObject({ status: "failed", output: null, error: { code: "content_refused" } });
  });

  it("cancels: queued requests never reach the helper; running ones are stopped", async () => {
    await startHelper();
    process.env.MOCK_PROVIDER_DELAY_MS = "3000";
    const { body } = await generate("Slow one");
    for (let i = 0; i < 100 && (await jobVia(body.job.id))?.status !== "generating"; i++) await new Promise((r) => setTimeout(r, 30));
    await cancelJob(req(`/api/jobs/${body.job.id}`, { method: "DELETE" }), ctx({ id: body.job.id }));
    expect((await waitForJob(jobVia, body.job.id)).status).toBe("cancelled");

    await worker!.stop();
    worker = null;
    // Helper gone: new requests are refused with a clear reason instead of waiting forever.
    process.env.MOCK_PROVIDER_DELAY_MS = "30";
    (globalThis as { __imageProvider?: unknown }).__imageProvider = undefined;
    const offline = await generate("While the helper is off");
    expect(offline.res.status).toBe(503);
    expect(offline.body.error!.message).toMatch(/offline/);
  });

  it("keeps duplicate and parallel requests out, using Firestore (works across servers)", async () => {
    await startHelper();
    process.env.MOCK_PROVIDER_DELAY_MS = "800";
    const key = "dup-key-123456";
    const a = await postGenerate(req("/api/generate", { json: { brief: "A", idempotencyKey: key } }));
    const b = await postGenerate(req("/api/generate", { json: { brief: "A", idempotencyKey: key } }));
    const ja = ((await a.json()) as { job: JobView }).job;
    expect(((await b.json()) as { job: JobView }).job.id).toBe(ja.id);
    expect((await generate("B")).res.status).toBe(409);
    await waitForJob(jobVia, ja.id);
  });
});

describe("live-site plumbing", () => {
  it("uploads large files in parts and files them in the library or the editor", async () => {
    process.env.IMAGE_PROVIDER = "helper";
    const bytes = await sharp({ create: { width: 1400, height: 1000, channels: 3, background: "#808080" } }).png({ compressionLevel: 0 }).toBuffer();
    expect(bytes.length).toBeGreaterThan(4 * 1024 * 1024);
    for (const target of ["library", "draft"] as const) {
      const { uploadId, partBytes } = (await (await startUpload(req("/api/uploads", { method: "POST" }))).json()) as { uploadId: string; partBytes: number };
      const parts = Math.ceil(bytes.length / partBytes);
      for (let i = 0; i < parts; i++) {
        const body = bytes.subarray(i * partBytes, (i + 1) * partBytes);
        const r = new NextRequest(`http://127.0.0.1:3109/api/uploads/${uploadId}/parts/${i}`, { method: "PUT", body, headers: { cookie: `studio_sid=${SESSION}` } });
        expect((await putPart(r, ctx({ id: uploadId, n: String(i) }))).status).toBe(200);
      }
      const res = await completeUpload(req(`/api/uploads/${uploadId}/complete`, { json: { parts, name: "big.png", target, meta: { title: "Big", category: "Website", tags: [] } } }), ctx({ id: uploadId }));
      expect(res.status).toBe(201);
      const out = (await res.json()) as { image?: ImageRecord; draft?: DraftInfo };
      expect((out.image ?? out.draft)!.width).toBe(1400);
    }
    const otherSession = await putPart(req(`/api/uploads/upl_nothere00/parts/0`, { method: "PUT" }), ctx({ id: "upl_nothere00", n: "0" }));
    expect(otherSession.status).toBe(400);
  });

  it("every server sees new images straight away (library version check)", async () => {
    const a = new FirestoreImageStore(getDb());
    const b = new FirestoreImageStore(getDb());
    expect(await a.list()).toHaveLength(0);
    const bytes = await png(100, 100);
    await b.create({ title: "From B", category: "Website", tags: [], sourceType: "uploaded", prompt: null, finalPrompt: null, promptTemplateId: null, promptTemplateTitle: null, provider: null, model: null, parentImageId: null, rootImageId: null, version: 1, notes: null, campaign: null, usageContext: null, owner: null, attribution: null, seeded: false }, bytes, { format: "png", mimeType: "image/png", width: 100, height: 100, size: bytes.length, hasAlpha: false });
    await new Promise((r) => setTimeout(r, 2100)); // past the short trust window
    expect((await a.list()).map((r) => r.title)).toEqual(["From B"]);
    const listing = (await (await listImages(req("/api/images"))).json()) as LibraryListing;
    expect(listing.total).toBe(1);
  });
});

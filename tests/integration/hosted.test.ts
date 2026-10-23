import { NextRequest } from "next/server";
import sharp from "sharp";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { GET as getDraftFile } from "@/app/api/drafts/[id]/file/route";
import { POST as saveDraft } from "@/app/api/drafts/[id]/save/route";
import { POST as postEdit } from "@/app/api/edit/route";
import { POST as postGenerate } from "@/app/api/generate/route";
import { GET as listImages } from "@/app/api/images/route";
import { DELETE as cancelJob, GET as getJob } from "@/app/api/jobs/[id]/route";
import { GET as getStatus } from "@/app/api/status/route";
import { POST as completeUpload } from "@/app/api/uploads/[id]/complete/route";
import { PUT as putPart } from "@/app/api/uploads/[id]/parts/[n]/route";
import { POST as startUpload } from "@/app/api/uploads/route";
import { getDb } from "@/lib/database/firestore";
import { FirestoreImageStore } from "@/lib/database/imageRepository";
import type { DraftInfo, Job, JobView } from "@/types/generation";
import type { ImageRecord, LibraryListing } from "@/types/image";
import type { StudioStatus } from "@/types/status";
import { ctx, png, req, resetAll, SESSION, waitForJob } from "./helpers";

/*
 * The live site (Vercel) setup: requests and unsaved results are kept in Firestore and each request is processed by
 * the server that received it, after answering. The test provider stands in for Curvet.
 */

const jobVia = async (id: string) => {
  const res = await getJob(req(`/api/jobs/${id}`), ctx({ id }));
  return res.status === 200 ? ((await res.json()) as { job: JobView }).job : null;
};

async function generate(brief: string, extra: Record<string, unknown> = {}) {
  const res = await postGenerate(req("/api/generate", { json: { brief, ...extra } }));
  return { res, body: (await res.json()) as { job: JobView; reused?: boolean; error?: { code: string; message: string } } };
}

const resetRunner = () => {
  (globalThis as { __jobRunner?: unknown }).__jobRunner = undefined;
  (globalThis as { __imageProvider?: unknown }).__imageProvider = undefined;
};

beforeEach(async () => {
  process.env.STUDIO_HOSTED = "1";
  process.env.MOCK_PROVIDER_DELAY_MS = "30";
  process.env.MOCK_PROVIDER_READY = "1";
  await resetAll();
  resetRunner();
});

afterEach(() => {
  delete process.env.STUDIO_HOSTED;
  resetRunner();
});

describe("live site: the server makes the image itself", () => {
  it("reports the live-site mode", async () => {
    const status = (await (await getStatus(req("/api/status?refresh=1"))).json()) as StudioStatus;
    expect(status).toMatchObject({ hosted: true, mode: "server", ai: { ready: true } });
  });

  it("generates, stores the result in Firestore, saves it, then edits it into v2", async () => {
    const { res, body } = await generate("A founder in a Dubai office");
    expect(res.status).toBe(202);
    const done = await waitForJob(jobVia, body.job.id);
    expect(done.status).toBe("completed");
    expect((await getDb().collection("drafts").doc(done.output!.id).get()).exists).toBe(true);
    const file = await getDraftFile(req(`/api/drafts/${done.output!.id}/file`), ctx({ id: done.output!.id }));
    expect(file.headers.get("content-type")).toBe("image/png");

    const saved = (await (await saveDraft(req(`/api/drafts/${done.output!.id}/save`, { json: { title: "Founder", category: "Campaigns", tags: [] } }), ctx({ id: done.output!.id }))).json()) as { image: ImageRecord };
    expect(saved.image).toMatchObject({ sourceType: "generated", provider: "mock", prompt: "A founder in a Dubai office" });

    const edit = await postEdit(req("/api/edit", { json: { source: { kind: "image", id: saved.image.id }, instruction: "Brighter" } }));
    const edited = await waitForJob(jobVia, ((await edit.json()) as { job: JobView }).job.id);
    expect(edited.status).toBe("completed");
    const v2 = (await (await saveDraft(req(`/api/drafts/${edited.output!.id}/save`, { json: { title: "Founder (edited)", category: "Campaigns", tags: [] } }), ctx({ id: edited.output!.id }))).json()) as { image: ImageRecord };
    expect(v2.image).toMatchObject({ version: 2, parentImageId: saved.image.id, sourceType: "edited" });
  });

  it("reports provider failures honestly", async () => {
    const { body } = await generate("Nope [[fail:content_refused]]");
    expect(await waitForJob(jobVia, body.job.id)).toMatchObject({ status: "failed", output: null, error: { code: "content_refused" } });
  });

  it("stops a running request when Cancel is pressed (on any server)", async () => {
    process.env.MOCK_PROVIDER_DELAY_MS = "6000";
    const { body } = await generate("Slow one");
    for (let i = 0; i < 100 && (await jobVia(body.job.id))?.status !== "generating"; i++) await new Promise((r) => setTimeout(r, 30));
    await cancelJob(req(`/api/jobs/${body.job.id}`, { method: "DELETE" }), ctx({ id: body.job.id }));
    expect((await waitForJob(jobVia, body.job.id, 15_000)).status).toBe("cancelled");
  });

  it("keeps duplicate and parallel requests out, counted in Firestore", async () => {
    process.env.MOCK_PROVIDER_DELAY_MS = "800";
    const key = "dup-key-123456";
    const a = await generate("A", { idempotencyKey: key });
    const b = await generate("A", { idempotencyKey: key });
    expect(b.body.job.id).toBe(a.body.job.id);
    expect(b.body.reused).toBe(true);
    expect((await generate("B")).res.status).toBe(409);
    await waitForJob(jobVia, a.body.job.id);
  });

  it("picks up a request whose server stopped before starting it", async () => {
    const job = { ...((await generate("Seed job")).body.job as Job) };
    await waitForJob(jobVia, job.id);
    const orphan: Job = { ...job, id: "job_orphan0000001", status: "queued", output: null, finishedAt: null, startedAt: null, createdAt: new Date(Date.now() - 60_000).toISOString() };
    await getDb().collection("jobs").doc(orphan.id).set(orphan);
    expect((await waitForJob(jobVia, orphan.id)).status).toBe("completed");
  });

  it("explains a missing AI connection without creating a job", async () => {
    process.env.MOCK_PROVIDER_READY = "0";
    const { res, body } = await generate("Office");
    expect(res.status).toBe(503);
    expect(body.error!.message).toMatch(/Settings/);
  });
});

describe("live-site plumbing", () => {
  it("uploads large files in parts and files them in the library or the editor", async () => {
    const bytes = await sharp({ create: { width: 1400, height: 1000, channels: 3, background: "#808080" } }).png({ compressionLevel: 0 }).toBuffer();
    expect(bytes.length).toBeGreaterThan(4 * 1024 * 1024);
    for (const target of ["library", "draft"] as const) {
      const { uploadId, partBytes } = (await (await startUpload(req("/api/uploads", { method: "POST" }))).json()) as { uploadId: string; partBytes: number };
      const parts = Math.ceil(bytes.length / partBytes);
      for (let i = 0; i < parts; i++) {
        const r = new NextRequest(`http://127.0.0.1:3109/api/uploads/${uploadId}/parts/${i}`, { method: "PUT", body: bytes.subarray(i * partBytes, (i + 1) * partBytes), headers: { cookie: `studio_sid=${SESSION}` } });
        expect((await putPart(r, ctx({ id: uploadId, n: String(i) }))).status).toBe(200);
      }
      const res = await completeUpload(req(`/api/uploads/${uploadId}/complete`, { json: { parts, name: "big.png", target, meta: { title: "Big", category: "Website", tags: [] } } }), ctx({ id: uploadId }));
      expect(res.status).toBe(201);
      const out = (await res.json()) as { image?: ImageRecord; draft?: DraftInfo };
      expect((out.image ?? out.draft)!.width).toBe(1400);
    }
    expect((await putPart(req(`/api/uploads/upl_nothere00/parts/0`, { method: "PUT" }), ctx({ id: "upl_nothere00", n: "0" }))).status).toBe(400);
  });

  it("every server sees new images straight away (library version check)", async () => {
    const a = new FirestoreImageStore(getDb());
    const b = new FirestoreImageStore(getDb());
    expect(await a.list()).toHaveLength(0);
    const bytes = await png(100, 100);
    await b.create({ title: "From B", category: "Website", tags: [], sourceType: "uploaded", prompt: null, finalPrompt: null, promptTemplateId: null, promptTemplateTitle: null, provider: null, model: null, parentImageId: null, rootImageId: null, version: 1, notes: null, campaign: null, usageContext: null, owner: null, attribution: null, seeded: false }, bytes, { format: "png", mimeType: "image/png", width: 100, height: 100, size: bytes.length, hasAlpha: false });
    await new Promise((r) => setTimeout(r, 2100)); // past the short trust window
    expect((await a.list()).map((r) => r.title)).toEqual(["From B"]);
    expect(((await (await listImages(req("/api/images"))).json()) as LibraryListing).total).toBe(1);
  });
});

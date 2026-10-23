import sharp from "sharp";
import { beforeEach, describe, expect, it } from "vitest";
import { GET as getDraftFile } from "@/app/api/drafts/[id]/file/route";
import { POST as saveDraft } from "@/app/api/drafts/[id]/save/route";
import { POST as uploadDraft } from "@/app/api/drafts/route";
import { POST as postEdit } from "@/app/api/edit/route";
import { POST as postGenerate } from "@/app/api/generate/route";
import { GET as getFile } from "@/app/api/images/[id]/file/route";
import { GET as getImage, PATCH as patchImage } from "@/app/api/images/[id]/route";
import { GET as getThumb } from "@/app/api/images/[id]/thumb/route";
import { GET as listImages, POST as uploadImage } from "@/app/api/images/route";
import { DELETE as cancelJob, GET as getJob } from "@/app/api/jobs/[id]/route";
import { POST as resetPrompt } from "@/app/api/prompts/[id]/reset/route";
import { PATCH as patchPrompt } from "@/app/api/prompts/[id]/route";
import { GET as listPrompts } from "@/app/api/prompts/route";
import { getDb } from "@/lib/database/firestore";
import { getImageStore } from "@/lib/database/imageRepository";
import { getRunner } from "@/lib/jobs/runner";
import { MissingFileError, putBlob, readBlob } from "@/lib/storage/blobStore";
import { sha256 } from "@/lib/storage/chunks";
import type { DraftInfo, JobView } from "@/types/generation";
import type { ImageRecord, LibraryListing } from "@/types/image";
import { ctx, fileForm, png, req, resetAll, SESSION, waitForJob } from "./helpers";

const jobOf = (id: string) => getRunner().get(id);

async function json<T>(res: Response): Promise<T> {
  return (await res.json()) as T;
}

async function upload(bytes: Buffer, name = "office.png", fields: Record<string, string> = { title: "Dubai Office", category: "Marketing", tags: "Dubai, office" }) {
  const res = await uploadImage(req("/api/images", { form: fileForm(bytes, name, fields) }));
  return { res, body: await json<{ image: ImageRecord; error?: { code: string; message: string } }>(res) };
}

async function generate(brief: string, extra: Record<string, unknown> = {}, session = SESSION) {
  const res = await postGenerate(req("/api/generate", { json: { brief, ...extra }, session }));
  return { res, body: await json<{ job: JobView; reused: boolean; error?: { code: string; message: string } }>(res) };
}

async function edit(source: { kind: "image" | "draft"; id: string }, instruction: string, extra: Record<string, unknown> = {}) {
  const res = await postEdit(req("/api/edit", { json: { source, instruction, ...extra } }));
  return { res, body: await json<{ job: JobView; error?: { code: string } }>(res) };
}

async function save(draftId: string, meta = { title: "Saved", category: "Campaigns", tags: ["Dubai"] }) {
  const res = await saveDraft(req(`/api/drafts/${draftId}/save`, { json: meta }), ctx({ id: draftId }));
  return { res, body: await json<{ image: ImageRecord }>(res) };
}

beforeEach(async () => {
  await resetAll();
  delete process.env.MAX_REQUESTS_PER_SESSION_PER_HOUR;
  delete process.env.MAX_IMAGE_REQUESTS_PER_DAY;
  process.env.MOCK_PROVIDER_READY = "1";
});

describe("chunked file storage in Firestore", () => {
  it("stores a multi-chunk file and reads back the exact bytes", async () => {
    const bytes = Buffer.from(Array.from({ length: 2_500_000 }, (_, i) => (i * 7) % 256));
    const info = await putBlob(getDb(), bytes, "image/png");
    expect(info.chunkCount).toBe(3);
    const back = await readBlob(getDb(), info.id);
    expect(sha256(back.bytes)).toBe(sha256(bytes));
  });

  it("detects a damaged or missing file instead of serving it", async () => {
    const info = await putBlob(getDb(), Buffer.alloc(1_000_000, 7), "image/png");
    await getDb().collection("blobs").doc(info.id).collection("chunks").doc("c0001").set({ index: 1, data: Buffer.alloc(10) });
    await expect(readBlob(getDb(), info.id)).rejects.toBeInstanceOf(MissingFileError);
    await expect(readBlob(getDb(), "blob_doesnotexist")).rejects.toBeInstanceOf(MissingFileError);
  });
});

describe("Journey A — library: upload, search, view, download (FR-01, FR-02, FR-08)", () => {
  it("uploads, finds by words and filters, serves the original and conversions without resizing", async () => {
    const bytes = await png(640, 400);
    const { res, body } = await upload(bytes);
    expect(res.status).toBe(201);
    const image = body.image;
    expect(image).toMatchObject({ title: "Dubai Office", category: "Marketing", tags: ["Dubai", "office"], sourceType: "uploaded", width: 640, height: 400, format: "png", version: 1, parentImageId: null, rootImageId: image.id });

    const found = await json<LibraryListing>(await listImages(req("/api/images?q=dubai%20off")));
    expect(found.images.map((i) => i.id)).toEqual([image.id]);
    expect(found.categories).toEqual([{ name: "Marketing", count: 1 }]);
    expect((await json<LibraryListing>(await listImages(req("/api/images?q=riyadh")))).images).toEqual([]);
    expect((await json<LibraryListing>(await listImages(req("/api/images?category=Blogs")))).images).toEqual([]);

    const original = await getFile(req(`/api/images/${image.id}/file`), ctx({ id: image.id }));
    expect(Buffer.from(await original.arrayBuffer()).equals(bytes)).toBe(true);

    const jpg = await getFile(req(`/api/images/${image.id}/file?format=jpg&download=1`), ctx({ id: image.id }));
    expect(jpg.headers.get("content-type")).toBe("image/jpeg");
    expect(jpg.headers.get("content-disposition")).toBe('attachment; filename="dubai-office.jpg"');
    const meta = await sharp(Buffer.from(await jpg.arrayBuffer())).metadata();
    expect([meta.width, meta.height, meta.format]).toEqual([640, 400, "jpeg"]);

    const thumb = await getThumb(req(`/api/images/${image.id}/thumb`), ctx({ id: image.id }));
    expect(thumb.headers.get("content-type")).toBe("image/webp");
  });

  it("keeps transparency in PNG and fills it with white in JPG", async () => {
    const { body } = await upload(await png(200, 200, 0), "clear.png", { title: "Clear", category: "Catalog" });
    expect(body.image.hasAlpha).toBe(true);
    const pngRes = await getFile(req(`/api/images/${body.image.id}/file?format=png`), ctx({ id: body.image.id }));
    expect((await sharp(Buffer.from(await pngRes.arrayBuffer())).stats()).isOpaque).toBe(false);
    const jpgRes = await getFile(req(`/api/images/${body.image.id}/file?format=jpg`), ctx({ id: body.image.id }));
    const { data } = await sharp(Buffer.from(await jpgRes.arrayBuffer())).raw().toBuffer({ resolveWithObject: true });
    expect([data[0], data[1], data[2]].every((v) => v > 245)).toBe(true);
  });

  it("rejects unsupported and damaged uploads with a clear message, storing nothing", async () => {
    const gif = await sharp(await png()).gif().toBuffer();
    const bad = await upload(gif, "anim.gif");
    expect(bad.res.status).toBe(400);
    expect(bad.body.error!.message).toMatch(/PNG, JPG or WebP/);
    const broken = await upload((await png(500, 500)).subarray(0, 80), "broken.png");
    expect(broken.res.status).toBe(400);
    expect((await json<LibraryListing>(await listImages(req("/api/images")))).total).toBe(0);
  });

  it("edits name and tags, and 404s cleanly for a missing image", async () => {
    const { body } = await upload(await png());
    const res = await patchImage(req(`/api/images/${body.image.id}`, { method: "PATCH", json: { title: "Renamed", tags: ["New"] } }), ctx({ id: body.image.id }));
    expect((await json<{ image: ImageRecord }>(res)).image).toMatchObject({ title: "Renamed", tags: ["New"], category: "Marketing" });
    const missing = await getImage(req("/api/images/img_nothinghere"), ctx({ id: "img_nothinghere" }));
    expect(missing.status).toBe(404);
  });
});

describe("Journey B — generate and save (FR-03, FR-07)", () => {
  it("queues a real job, returns the provider's image, and saves it with full metadata", async () => {
    const { res, body } = await generate("A founder in a Dubai office, empty space on the left", { templateId: "corporate-photography", placeholders: { SUBJECT: "a founder" }, options: { aspect: "portrait" } });
    expect(res.status).toBe(202);
    expect(body.job.status).toBe("queued");
    expect(body.job.request.composedPrompt).toContain("STYLE GUIDELINE — Corporate Photography");
    expect(body.job.request.composedPrompt).toContain("a founder in the location described in the request");

    const done = await waitForJob(jobOf, body.job.id);
    expect(done.status).toBe("completed");
    expect(done.output).toMatchObject({ origin: "generate", width: 256, height: 384, format: "png" });

    const preview = await getDraftFile(req(`/api/drafts/${done.output!.id}/file?format=png&download=1`), ctx({ id: done.output!.id }));
    expect(preview.headers.get("content-disposition")).toMatch(/attachment; filename=".+\.png"/);

    const saved = await save(done.output!.id, { title: "Founder Portrait", category: "Campaigns", tags: ["Dubai"] });
    expect(saved.res.status).toBe(201);
    expect(saved.body.image).toMatchObject({
      title: "Founder Portrait",
      sourceType: "generated",
      prompt: "A founder in a Dubai office, empty space on the left",
      promptTemplateId: "corporate-photography",
      promptTemplateTitle: "Corporate Photography",
      provider: "mock",
      model: "test-image-model",
      width: 256,
      height: 384,
      version: 1,
    });
    expect(saved.body.image.finalPrompt).toContain("Portrait format");

    // Saving twice returns the same image instead of a duplicate.
    expect((await save(done.output!.id)).body.image.id).toBe(saved.body.image.id);
    const listing = await json<LibraryListing>(await listImages(req("/api/images?q=founder")));
    expect(listing.images.map((i) => i.id)).toEqual([saved.body.image.id]);
  });

  it("guards against duplicate and runaway requests (PRD §21.2)", async () => {
    const key = "abcdefgh-1234";
    const first = await generate("Office", { idempotencyKey: key });
    const again = await generate("Office", { idempotencyKey: key });
    expect(again.body.job.id).toBe(first.body.job.id);
    expect(again.body.reused).toBe(true);
    const parallel = await generate("Another office");
    expect(parallel.res.status).toBe(409);
    await waitForJob(jobOf, first.body.job.id);

    process.env.MAX_REQUESTS_PER_SESSION_PER_HOUR = "2";
    const second = await generate("Office two");
    await waitForJob(jobOf, second.body.job.id);
    const third = await generate("Office three");
    expect(third.res.status).toBe(429);
    expect(third.body.error!.code).toBe("rate_limited");

    process.env.MAX_REQUESTS_PER_SESSION_PER_HOUR = "50";
    process.env.MAX_IMAGE_REQUESTS_PER_DAY = "2";
    const budget = await generate("Office four", {}, "99999999-2222-3333-4444-555555555555");
    expect(budget.res.status).toBe(429);
    expect(budget.body.error!.code).toBe("budget_reached");
  });

  it("reports provider failures honestly and never as a result", async () => {
    const { body } = await generate("Something [[fail:content_refused]]");
    const done = await waitForJob(jobOf, body.job.id);
    expect(done.status).toBe("failed");
    expect(done.output).toBeNull();
    expect(done.error).toMatchObject({ code: "content_refused", retryable: false });
  });

  it("explains a missing AI connection without creating a job or spending budget", async () => {
    process.env.MOCK_PROVIDER_READY = "0";
    const { res, body } = await generate("Office");
    expect(res.status).toBe(503);
    expect(body.error!.message).toMatch(/Settings/);
  });

  it("rejects settings the provider doesn't support, empty briefs, and requests with no session", async () => {
    expect((await generate("   ")).res.status).toBe(400);
    expect((await generate("Office", { templateId: "existing-image-modification" })).res.status).toBe(400);
    expect((await generate("Office", { templateId: "nope" })).res.status).toBe(400);
    const noSession = await postGenerate(req("/api/generate", { json: { brief: "x" }, session: null }));
    expect(noSession.status).toBe(401);
  });

  it("cancels a queued request before anything is sent", async () => {
    process.env.MOCK_PROVIDER_DELAY_MS = "400";
    const first = await generate("One", {}, "aaaaaaaa-2222-3333-4444-555555555555");
    const second = await generate("Two");
    const res = await cancelJob(req(`/api/jobs/${second.body.job.id}`, { method: "DELETE" }), ctx({ id: second.body.job.id }));
    expect((await json<{ job: JobView }>(res)).job.status).toBe("cancelled");
    expect((await waitForJob(jobOf, first.body.job.id)).status).toBe("completed");
    const other = await getJob(req(`/api/jobs/${first.body.job.id}`), ctx({ id: first.body.job.id }));
    expect(other.status).toBe(404); // another session's job isn't visible
    process.env.MOCK_PROVIDER_DELAY_MS = "30";
  });
});

describe("Journey C — edit, compare, save versions (FR-05, FR-06, §13.2)", () => {
  it("saves an edit as a new version and never touches the original", async () => {
    const { body } = await upload(await png(400, 300), "office.png", { title: "Office", category: "Marketing" });
    const original = body.image;
    const before = sha256((await getImageStore().getFile(original.id)).bytes);

    const e1 = await edit({ kind: "image", id: original.id }, "Make the background lighter");
    expect(e1.res.status).toBe(202);
    expect(e1.body.job.request.composedPrompt).toContain("EDITING GUIDELINE — Existing Image Modification");
    const d1 = (await waitForJob(jobOf, e1.body.job.id)).output!;
    expect(d1).toMatchObject({ origin: "edit", parent: { kind: "image", id: original.id }, width: 400, height: 300 });

    // A second, unsaved refinement on top of the first.
    const e2 = await edit({ kind: "draft", id: d1.id }, "Remove the plant", { editMode: "background" });
    const d2 = (await waitForJob(jobOf, e2.body.job.id)).output!;
    const saved = (await save(d2.id, { title: "Office (edited)", category: "Marketing", tags: [] })).body.image;
    expect(saved).toMatchObject({ sourceType: "edited", parentImageId: original.id, rootImageId: original.id, version: 2, prompt: "Edit 1: Make the background lighter → Edit 2: Remove the plant", promptTemplateId: "background-replacement" });

    // Saving the earlier step later gets the next number in the family.
    const savedFirst = (await save(d1.id, { title: "Office (lighter)", category: "Marketing", tags: [] })).body.image;
    expect(savedFirst).toMatchObject({ version: 3, parentImageId: original.id });

    const details = await json<{ versions: ImageRecord[] }>(await getImage(req(`/api/images/${original.id}`), ctx({ id: original.id })));
    expect(details.versions.map((v) => v.version)).toEqual([1, 2, 3]);
    expect(sha256((await getImageStore().getFile(original.id)).bytes)).toBe(before);
  });

  it("an upload edited and saved keeps the original as version 1", async () => {
    const res = await uploadDraft(req("/api/drafts", { form: fileForm(await png(300, 300), "desk.png") }));
    const { draft } = await json<{ draft: DraftInfo }>(res);
    expect((await json<LibraryListing>(await listImages(req("/api/images")))).total).toBe(0); // not in the library until saved

    const e = await edit({ kind: "draft", id: draft.id }, "Brighter");
    const out = (await waitForJob(jobOf, e.body.job.id)).output!;
    const saved = (await save(out.id, { title: "Desk", category: "Blogs", tags: [] })).body.image;
    const all = (await json<LibraryListing>(await listImages(req("/api/images")))).images;
    const original = all.find((i) => i.id === saved.parentImageId)!;
    expect(original).toMatchObject({ title: "Desk (original)", sourceType: "uploaded", version: 1 });
    expect(saved).toMatchObject({ version: 2, rootImageId: original.id });
  });

  it("refuses edits without an instruction or with a missing source", async () => {
    expect((await edit({ kind: "image", id: "img_missingmissing" }, "x")).res.status).toBe(404);
    expect((await edit({ kind: "draft", id: "drf_missingmissing" }, "x")).res.status).toBe(404);
    const { body } = await upload(await png());
    expect((await edit({ kind: "image", id: body.image.id }, "  ")).res.status).toBe(400);
  });
});

describe("Journey D — prompt guidelines are configurable (PRD §11)", () => {
  it("lists nine, saves an edited guideline, uses it, and resets it", async () => {
    const list = await json<{ templates: { id: string; isDefault: boolean }[] }>(await listPrompts());
    expect(list.templates).toHaveLength(9);
    const res = await patchPrompt(req("/api/prompts/blog-hero-image", { method: "PATCH", json: { template: "Create an editorial image about [ARTICLE TOPIC] with a calm navy palette." } }), ctx({ id: "blog-hero-image" }));
    expect((await json<{ template: { isDefault: boolean; template: string } }>(res)).template).toMatchObject({ isDefault: false, template: expect.stringContaining("calm navy palette") });
    const { body } = await generate("Free zone vs mainland", { templateId: "blog-hero-image" });
    expect(body.job.request.composedPrompt).toContain("calm navy palette");
    await waitForJob(jobOf, body.job.id);
    const reset = await resetPrompt(req("/api/prompts/blog-hero-image/reset", { method: "POST" }), ctx({ id: "blog-hero-image" }));
    expect((await json<{ template: { isDefault: boolean } }>(reset)).template.isDefault).toBe(true);
  });
});

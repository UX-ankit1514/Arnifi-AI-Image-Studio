import type { NextRequest } from "next/server";
import { getImageStore } from "@/lib/database/imageRepository";
import { categoryCounts, filterImages } from "@/lib/images/search";
import { apiError, fromError, ok } from "@/lib/server/http";
import { uploadToLibrary } from "@/lib/server/library";
import { imageMetaSchema, parseTagList } from "@/lib/validation/schemas";
import { SOURCE_TYPES, type LibraryListing, type SourceType } from "@/types/image";

/* GET: the library, searched and filtered (FR-01). POST: upload an existing image (FR-02). */

export async function GET(request: NextRequest) {
  try {
    const store = getImageStore();
    const all = await store.list();
    const params = request.nextUrl.searchParams;
    const source = params.get("source");
    const images = filterImages(all, {
      q: params.get("q") ?? "",
      category: params.get("category"),
      source: SOURCE_TYPES.includes(source as SourceType) ? (source as SourceType) : null,
    });
    return ok<LibraryListing>({ images, categories: categoryCounts(all), total: all.length, storage: store.kind });
  } catch (e) {
    return fromError(e);
  }
}

export async function POST(request: NextRequest) {
  try {
    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      return apiError(400, "file_invalid", "The upload didn’t arrive complete. Check the file is under 10 MB and try again.");
    }
    const file = form.get("file");
    if (!(file instanceof File)) return apiError(400, "file_invalid", "Choose an image to upload.");
    const meta = imageMetaSchema.parse({
      title: form.get("title") || file.name.replace(/\.[a-z0-9]+$/i, "").replace(/[-_]+/g, " "),
      category: form.get("category"),
      tags: parseTagList(String(form.get("tags") ?? "")),
      notes: form.get("notes") || null,
    });
    const bytes = Buffer.from(await file.arrayBuffer());
    const record = await uploadToLibrary(bytes, meta);
    return ok({ image: record }, 201);
  } catch (e) {
    return fromError(e);
  }
}

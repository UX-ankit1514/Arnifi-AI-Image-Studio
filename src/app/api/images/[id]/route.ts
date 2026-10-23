import type { NextRequest } from "next/server";
import { getImageStore } from "@/lib/database/imageRepository";
import { familyOf, lineage } from "@/lib/images/versions";
import { apiError, fromError, ok, readJson } from "@/lib/server/http";
import { imagePatchSchema } from "@/lib/validation/schemas";

/* GET: one image with its related versions (PRD §7.2 step 4). PATCH: edit name, category, tags and notes. */

export async function GET(_request: NextRequest, { params }: RouteContext<"/api/images/[id]">) {
  try {
    const { id } = await params;
    const store = getImageStore();
    const image = await store.get(id);
    if (!image) return apiError(404, "not_found", "This image isn’t in the library any more.");
    const all = await store.list();
    return ok({ image, versions: familyOf(all, image.rootImageId), lineage: lineage(all, image), storage: store.kind });
  } catch (e) {
    return fromError(e);
  }
}

export async function PATCH(request: NextRequest, { params }: RouteContext<"/api/images/[id]">) {
  try {
    const { id } = await params;
    const patch = await readJson(request, imagePatchSchema);
    const image = await getImageStore().update(id, patch);
    return ok({ image });
  } catch (e) {
    return fromError(e);
  }
}

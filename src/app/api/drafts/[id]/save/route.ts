import type { NextRequest } from "next/server";
import { fromError, ok, readJson } from "@/lib/server/http";
import { saveDraftToLibrary } from "@/lib/server/library";
import { saveDraftSchema } from "@/lib/validation/schemas";

/* Save to Library (FR-07): stores the file and its metadata as a new image; never overwrites the original. */
export async function POST(request: NextRequest, { params }: RouteContext<"/api/drafts/[id]/save">) {
  try {
    const { id } = await params;
    const meta = await readJson(request, saveDraftSchema);
    const image = await saveDraftToLibrary(id, meta);
    return ok({ image }, 201);
  } catch (e) {
    return fromError(e);
  }
}

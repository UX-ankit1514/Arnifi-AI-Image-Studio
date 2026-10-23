import type { NextRequest } from "next/server";
import { getImageStore } from "@/lib/database/imageRepository";
import { makeThumbnail } from "@/lib/images/process";
import { fileResponse, fromError } from "@/lib/server/http";

/* Grid thumbnail (PRD §23.1: optimised thumbnails). Ids never change their pixels, so browsers may cache it for good. */
export async function GET(_request: NextRequest, { params }: RouteContext<"/api/images/[id]/thumb">) {
  try {
    const { id } = await params;
    const store = getImageStore();
    const thumb = (await store.getThumb(id)) ?? (await makeThumbnail((await store.getFile(id)).bytes));
    return fileResponse(thumb.data, thumb.mimeType, { immutable: true });
  } catch (e) {
    return fromError(e);
  }
}

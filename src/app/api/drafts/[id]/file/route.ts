import type { NextRequest } from "next/server";
import { convertForDownload, downloadName } from "@/lib/images/process";
import { fileResponse, fromError } from "@/lib/server/http";
import { getDraft } from "@/lib/storage/draftStore";

/* An unsaved result or upload: preview it, or download it as PNG/JPG before (or without) saving. */
export async function GET(request: NextRequest, { params }: RouteContext<"/api/drafts/[id]/file">) {
  try {
    const { id } = await params;
    const { info, bytes } = await getDraft(id);
    const q = request.nextUrl.searchParams;
    const format = q.get("format") === "jpg" ? "jpg" : q.get("format") === "png" ? "png" : null;
    const name = (q.get("name") ?? "").slice(0, 80) || (info.origin === "edit" ? "arnifi-edited-image" : info.origin === "generate" ? "arnifi-generated-image" : "arnifi-image");
    if (!format) return fileResponse(bytes, info.mimeType, { immutable: true });
    const out = await convertForDownload(bytes, info.format, format);
    return fileResponse(out.data, out.mimeType, { filename: q.get("download") === "1" ? downloadName(name, 1, format) : undefined });
  } catch (e) {
    return fromError(e);
  }
}

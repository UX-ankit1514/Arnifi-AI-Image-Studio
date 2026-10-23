import type { NextRequest } from "next/server";
import { getImageStore } from "@/lib/database/imageRepository";
import { convertForDownload, downloadName, type DownloadFormat } from "@/lib/images/process";
import { fileResponse, fromError } from "@/lib/server/http";

/*
 * The stored file (FR-08). No format → the original bytes, for previews. ?format=png|jpg → converted without resizing
 * or watermarking; &download=1 → saved as a file named after the title.
 */
export async function GET(request: NextRequest, { params }: RouteContext<"/api/images/[id]/file">) {
  try {
    const { id } = await params;
    const { record, bytes } = await getImageStore().getFile(id);
    const q = request.nextUrl.searchParams;
    const format = q.get("format") === "jpg" ? "jpg" : q.get("format") === "png" ? "png" : null;
    const download = q.get("download") === "1";
    if (!format) return fileResponse(bytes, record.mimeType, { immutable: true, filename: download ? downloadName(record.title, record.version, record.format === "jpeg" ? "jpg" : "png") : undefined });
    const out = await convertForDownload(bytes, record.format, format as DownloadFormat);
    return fileResponse(out.data, out.mimeType, { immutable: !download, filename: download ? downloadName(record.title, record.version, format) : undefined });
  } catch (e) {
    return fromError(e);
  }
}

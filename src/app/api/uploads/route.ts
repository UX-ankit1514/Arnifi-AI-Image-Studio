import type { NextRequest } from "next/server";
import { fromError, noSession, ok, sessionOf } from "@/lib/server/http";
import { startUpload, UPLOAD_PART_BYTES } from "@/lib/server/uploads";

/* Start an upload in parts (live site, files over 4 MB). */
export async function POST(request: NextRequest) {
  const sessionId = sessionOf(request);
  if (!sessionId) return noSession();
  try {
    return ok({ uploadId: await startUpload(sessionId), partBytes: UPLOAD_PART_BYTES }, 201);
  } catch (e) {
    return fromError(e);
  }
}

import type { NextRequest } from "next/server";
import { getImageStore } from "@/lib/database/imageRepository";
import { getRunner } from "@/lib/jobs/runner";
import { buildEditRequest, RequestError } from "@/lib/server/compose";
import { apiError, fromError, noSession, ok, readJson, sessionOf } from "@/lib/server/http";
import { getDraftInfo } from "@/lib/storage/draftStore";
import { editRequestSchema } from "@/lib/validation/schemas";

/** On Vercel the image is made by this function after it answers; GPT Image can take a minute or two. */
export const maxDuration = 300;

/* Apply Changes (FR-05): checks the source exists, then queues an edit job. The source itself is never changed. */
export async function POST(request: NextRequest) {
  const sessionId = sessionOf(request);
  if (!sessionId) return noSession();
  try {
    const input = await readJson(request, editRequestSchema);
    if (input.source.kind === "image") {
      if (!(await getImageStore().get(input.source.id))) return apiError(404, "not_found", "The original image isn’t in the library any more. Choose another image.");
    } else {
      await getDraftInfo(input.source.id);
    }
    const jobRequest = await buildEditRequest(input);
    const result = await getRunner().submit("edit", jobRequest, sessionId, input.idempotencyKey);
    if (!result.ok) return apiError(result.status, result.error.code, result.error.message, { retryable: result.error.retryable, resetAt: result.error.resetAt });
    return ok({ job: result.job, reused: result.reused }, 202);
  } catch (e) {
    if (e instanceof RequestError) return apiError(400, "invalid_request", e.message);
    return fromError(e);
  }
}

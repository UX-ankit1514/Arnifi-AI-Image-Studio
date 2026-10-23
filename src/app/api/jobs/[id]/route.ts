import type { NextRequest } from "next/server";
import { getRunner } from "@/lib/jobs/runner";
import { apiError, fromError, noSession, ok, sessionOf } from "@/lib/server/http";

/** On Vercel the image is made by this function after it answers; GPT Image can take a minute or two. */
export const maxDuration = 300;

/* GET: where a request is (queued, generating, completed, failed). DELETE: cancel it. */

export async function GET(request: NextRequest, { params }: RouteContext<"/api/jobs/[id]">) {
  const sessionId = sessionOf(request);
  if (!sessionId) return noSession();
  try {
    const { id } = await params;
    const job = await getRunner().get(id);
    if (!job || job.sessionId !== sessionId) return apiError(404, "not_found", "This request isn’t available any more.");
    return ok({ job });
  } catch (e) {
    return fromError(e);
  }
}

export async function DELETE(request: NextRequest, { params }: RouteContext<"/api/jobs/[id]">) {
  const sessionId = sessionOf(request);
  if (!sessionId) return noSession();
  try {
    const { id } = await params;
    const job = await getRunner().cancel(id, sessionId);
    if (!job) return apiError(404, "not_found", "This request isn’t running any more.");
    return ok({ job });
  } catch (e) {
    return fromError(e);
  }
}

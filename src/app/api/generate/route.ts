import type { NextRequest } from "next/server";
import { getProvider } from "@/lib/ai";
import { getRunner } from "@/lib/jobs/runner";
import { buildGenerateRequest, RequestError } from "@/lib/server/compose";
import { apiError, fromError, noSession, ok, readJson, sessionOf } from "@/lib/server/http";
import { generateRequestSchema } from "@/lib/validation/schemas";

/* Generate Image (FR-03): validate → compose → queue a job. The browser then follows GET /api/jobs/[id]. */
export async function POST(request: NextRequest) {
  const sessionId = sessionOf(request);
  if (!sessionId) return noSession();
  try {
    const input = await readJson(request, generateRequestSchema);
    const jobRequest = await buildGenerateRequest(input, getProvider().getSupportedOptions());
    const result = await getRunner().submit("generate", jobRequest, sessionId, input.idempotencyKey);
    if (!result.ok) return apiError(result.status, result.error.code, result.error.message, { retryable: result.error.retryable, resetAt: result.error.resetAt });
    return ok({ job: result.job, reused: result.reused }, 202);
  } catch (e) {
    if (e instanceof RequestError) return apiError(400, "invalid_request", e.message);
    return fromError(e);
  }
}

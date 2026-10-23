import type { NextRequest } from "next/server";
import { fromError, noSession, ok, sessionOf } from "@/lib/server/http";
import { putUploadPart } from "@/lib/server/uploads";

export async function PUT(request: NextRequest, { params }: RouteContext<"/api/uploads/[id]/parts/[n]">) {
  const sessionId = sessionOf(request);
  if (!sessionId) return noSession();
  try {
    const { id, n } = await params;
    await putUploadPart(id, sessionId, Number(n), Buffer.from(await request.arrayBuffer()));
    return ok({ ok: true });
  } catch (e) {
    return fromError(e);
  }
}

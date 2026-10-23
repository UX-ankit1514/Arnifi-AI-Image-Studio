import type { NextRequest } from "next/server";
import { fromError, ok } from "@/lib/server/http";
import { getDraftInfo } from "@/lib/storage/draftStore";

export async function GET(_request: NextRequest, { params }: RouteContext<"/api/drafts/[id]">) {
  try {
    const { id } = await params;
    return ok({ draft: await getDraftInfo(id) });
  } catch (e) {
    return fromError(e);
  }
}

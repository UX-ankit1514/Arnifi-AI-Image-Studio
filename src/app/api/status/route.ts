import type { NextRequest } from "next/server";
import { fromError, ok } from "@/lib/server/http";
import { studioStatus } from "@/lib/server/status";

export async function GET(request: NextRequest) {
  try {
    return ok(await studioStatus(request.nextUrl.searchParams.get("refresh") === "1"));
  } catch (e) {
    return fromError(e);
  }
}

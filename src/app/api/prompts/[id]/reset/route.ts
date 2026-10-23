import type { NextRequest } from "next/server";
import { getTemplate, resetTemplate } from "@/lib/database/templateRepository";
import { apiError, fromError, ok } from "@/lib/server/http";

export async function POST(_request: NextRequest, { params }: RouteContext<"/api/prompts/[id]/reset">) {
  try {
    const { id } = await params;
    if (!(await getTemplate(id))) return apiError(404, "not_found", "This guideline doesn’t exist.");
    return ok({ template: await resetTemplate(id) });
  } catch (e) {
    return fromError(e);
  }
}

import type { NextRequest } from "next/server";
import { getTemplate, updateTemplate } from "@/lib/database/templateRepository";
import { apiError, fromError, ok, readJson } from "@/lib/server/http";
import { templatePatchSchema } from "@/lib/validation/schemas";

export async function GET(_request: NextRequest, { params }: RouteContext<"/api/prompts/[id]">) {
  const { id } = await params;
  const template = await getTemplate(id);
  if (!template) return apiError(404, "not_found", "This guideline doesn’t exist.");
  return ok({ template });
}

/* Edit a guideline (PRD §11: editable templates). Stored as an override; the default can be restored. */
export async function PATCH(request: NextRequest, { params }: RouteContext<"/api/prompts/[id]">) {
  try {
    const { id } = await params;
    if (!(await getTemplate(id))) return apiError(404, "not_found", "This guideline doesn’t exist.");
    const patch = await readJson(request, templatePatchSchema);
    return ok({ template: await updateTemplate(id, patch) });
  } catch (e) {
    return fromError(e);
  }
}

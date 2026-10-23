import type { NextRequest } from "next/server";
import { z } from "zod";
import { fromError, noSession, ok, readJson, sessionOf } from "@/lib/server/http";
import { uploadDraft, uploadToLibrary } from "@/lib/server/library";
import { finishUpload } from "@/lib/server/uploads";
import { imageMetaSchema } from "@/lib/validation/schemas";

const body = z.object({
  parts: z.number().int().min(1).max(20),
  name: z.string().max(200).default("image"),
  target: z.enum(["library", "draft"]),
  meta: imageMetaSchema.optional(),
});

/* Join the parts and file the image: into the library (Upload Image) or as an editor source (Edit Image). */
export async function POST(request: NextRequest, { params }: RouteContext<"/api/uploads/[id]/complete">) {
  const sessionId = sessionOf(request);
  if (!sessionId) return noSession();
  try {
    const { id } = await params;
    const input = await readJson(request, body);
    const bytes = await finishUpload(id, sessionId, input.parts);
    if (input.target === "draft") return ok({ draft: await uploadDraft(bytes, input.name) }, 201);
    const meta = imageMetaSchema.parse(input.meta ?? { title: input.name.replace(/\.[a-z0-9]+$/i, ""), category: "Marketing" });
    return ok({ image: await uploadToLibrary(bytes, meta) }, 201);
  } catch (e) {
    return fromError(e);
  }
}

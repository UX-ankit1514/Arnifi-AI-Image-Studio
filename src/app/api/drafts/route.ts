import type { NextRequest } from "next/server";
import { apiError, fromError, ok } from "@/lib/server/http";
import { uploadDraft } from "@/lib/server/library";

/* Upload a picture to edit (PRD §9.2 step 1). It stays unsaved until an edit of it is saved to the library. */
export async function POST(request: NextRequest) {
  try {
    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      return apiError(400, "file_invalid", "The upload didn’t arrive complete. Check the file is under 10 MB and try again.");
    }
    const file = form.get("file");
    if (!(file instanceof File)) return apiError(400, "file_invalid", "Choose an image to upload.");
    const draft = await uploadDraft(Buffer.from(await file.arrayBuffer()), file.name.slice(0, 200));
    return ok({ draft }, 201);
  } catch (e) {
    return fromError(e);
  }
}

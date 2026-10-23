import { getImageStore } from "@/lib/database/imageRepository";
import { listTemplates } from "@/lib/database/templateRepository";
import { fromError, ok } from "@/lib/server/http";

/* The nine guidelines, each with the newest saved image made with it as its example, if there is one (PRD §10.2). */
export async function GET() {
  try {
    const [templates, images] = await Promise.all([listTemplates(), getImageStore().list().catch(() => [])]);
    const examples: Record<string, string> = {};
    for (const image of [...images].sort((a, b) => b.createdAt.localeCompare(a.createdAt))) {
      if (image.promptTemplateId && !examples[image.promptTemplateId]) examples[image.promptTemplateId] = image.id;
    }
    return ok({ templates, examples });
  } catch (e) {
    return fromError(e);
  }
}

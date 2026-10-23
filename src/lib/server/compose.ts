import "server-only";
import { EDIT_TEMPLATE_BY_MODE } from "@/data/promptTemplates";
import type { SupportedOptions } from "@/lib/ai/imageProvider";
import { getTemplate } from "@/lib/database/templateRepository";
import { composePrompt } from "@/lib/prompts/promptComposer";
import type { EditRequestInput, GenerateRequestInput } from "@/lib/validation/schemas";
import type { GenerationOptions, JobRequest } from "@/types/generation";

/*
 * Server-side request building: validates settings against what the provider really supports (PRD §8.2 step 4 —
 * never pretend an unsupported option exists), then composes the final prompt. The browser uses the same composer
 * for its preview, so "Copy Prompt" matches what is sent.
 */

export class RequestError extends Error {}

export function effectiveOptions(options: GenerationOptions, supported: SupportedOptions): GenerationOptions {
  if (!supported.aspect.values.includes(options.aspect)) throw new RequestError("That shape isn’t available with this image connection.");
  if (options.background === "transparent" && !supported.background.supported) {
    throw new RequestError(supported.background.note ?? "Transparent backgrounds aren’t available with this image connection.");
  }
  if (options.quality === "high" && !supported.quality.supported) {
    throw new RequestError(supported.quality.note ?? "Quality settings aren’t available with this image connection.");
  }
  return {
    aspect: options.aspect,
    quality: supported.quality.supported ? options.quality : "standard",
    background: supported.background.supported ? options.background : "normal",
  };
}

export async function buildGenerateRequest(input: GenerateRequestInput, supported: SupportedOptions): Promise<JobRequest> {
  const template = input.templateId ? await getTemplate(input.templateId) : null;
  if (input.templateId && !template) throw new RequestError("That guideline isn’t available any more. Choose another or remove it.");
  if (template && template.kind !== "generate") throw new RequestError("That guideline is for editing images. Use it in Edit Image.");
  const options = effectiveOptions(input.options, supported);
  const composed = composePrompt({ mode: "generate", request: input.brief, template, placeholders: input.placeholders, applyBrandRules: input.applyBrandRules, options });
  return {
    brief: input.brief,
    instruction: null,
    templateId: template?.id ?? null,
    templateTitle: template?.title ?? null,
    placeholders: input.placeholders,
    options,
    applyBrandRules: input.applyBrandRules,
    editMode: null,
    source: null,
    composedPrompt: composed.prompt,
  };
}

export async function buildEditRequest(input: EditRequestInput): Promise<JobRequest> {
  const template = await getTemplate(EDIT_TEMPLATE_BY_MODE[input.editMode]);
  const placeholders = { ...input.placeholders };
  const composed = composePrompt({ mode: "edit", request: input.instruction, template, placeholders, applyBrandRules: input.applyBrandRules });
  return {
    brief: null,
    instruction: input.instruction,
    templateId: template?.id ?? null,
    templateTitle: template?.title ?? null,
    placeholders,
    options: { aspect: "landscape", quality: "standard", background: "normal" },
    applyBrandRules: input.applyBrandRules,
    editMode: input.editMode,
    source: input.source,
    composedPrompt: composed.prompt,
  };
}

import { z } from "zod";
import { ASPECT_RATIOS, BACKGROUNDS, EDIT_MODES, QUALITIES } from "@/types/generation";
import { LIMITS } from "./limits";

/* Request validation for every API route (PRD §14.2, §21.1). Clear, plain messages — they are shown to people. */

const trimmed = (max: number, label: string) =>
  z
    .string()
    .trim()
    .max(max, `${label} can be at most ${max} characters.`);

export const tagsSchema = z
  .array(trimmed(LIMITS.maxTagChars, "A tag").min(1))
  .max(LIMITS.maxTags, `Use at most ${LIMITS.maxTags} tags.`)
  .transform((tags) => dedupeTags(tags));

export function dedupeTags(tags: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of tags) {
    const tag = raw.trim().replace(/\s+/g, " ");
    const key = tag.toLowerCase();
    if (!tag || seen.has(key)) continue;
    seen.add(key);
    out.push(tag);
  }
  return out;
}

/** "Dubai, office,  business " → ["Dubai", "office", "business"]. */
export function parseTagList(value: string): string[] {
  return dedupeTags(value.split(/[,\n]/));
}

const optionalText = (max: number, label: string) =>
  trimmed(max, label)
    .nullable()
    .optional()
    .transform((v) => (v ? v : null));

export const imageMetaSchema = z.object({
  title: trimmed(LIMITS.maxTitleChars, "The title").min(1, "Give the image a title."),
  category: trimmed(40, "The category").min(1, "Choose a category."),
  tags: tagsSchema.default([]),
  notes: optionalText(LIMITS.maxNotesChars, "Notes"),
  campaign: optionalText(120, "Campaign"),
  usageContext: optionalText(200, "Usage context"),
  owner: optionalText(120, "Owner"),
  attribution: optionalText(200, "Attribution"),
});
export type ImageMetaInput = z.infer<typeof imageMetaSchema>;

export const imagePatchSchema = imageMetaSchema.partial().refine((v) => Object.keys(v).length > 0, "Nothing to update.");

export const optionsSchema = z.object({
  aspect: z.enum(ASPECT_RATIOS).default("landscape"),
  quality: z.enum(QUALITIES).default("standard"),
  background: z.enum(BACKGROUNDS).default("normal"),
});

const placeholdersSchema = z
  .record(z.string().max(60), z.string().trim().max(300, "Keep each guideline field under 300 characters."))
  .default({});

export const generateRequestSchema = z.object({
  brief: z
    .string()
    .trim()
    .min(1, "Describe the image you’d like to create.")
    .max(LIMITS.maxBriefChars, `Keep the description under ${LIMITS.maxBriefChars} characters.`),
  templateId: z.string().max(80).nullable().default(null),
  placeholders: placeholdersSchema,
  options: optionsSchema.default({ aspect: "landscape", quality: "standard", background: "normal" }),
  applyBrandRules: z.boolean().default(true),
  idempotencyKey: z.string().min(8).max(80).nullable().default(null),
});
export type GenerateRequestInput = z.infer<typeof generateRequestSchema>;

export const sourceRefSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("image"), id: z.string().min(1).max(80) }),
  z.object({ kind: z.literal("draft"), id: z.string().min(1).max(80) }),
]);

export const editRequestSchema = z.object({
  source: sourceRefSchema,
  instruction: z
    .string()
    .trim()
    .min(1, "Describe the change you’d like.")
    .max(LIMITS.maxBriefChars, `Keep the instruction under ${LIMITS.maxBriefChars} characters.`),
  editMode: z.enum(EDIT_MODES).default("general"),
  placeholders: placeholdersSchema,
  applyBrandRules: z.boolean().default(true),
  idempotencyKey: z.string().min(8).max(80).nullable().default(null),
});
export type EditRequestInput = z.infer<typeof editRequestSchema>;

export const saveDraftSchema = imageMetaSchema;

export const templatePatchSchema = z
  .object({
    title: trimmed(80, "The title").min(1, "Give the guideline a title."),
    useCase: trimmed(160, "The use case").min(1, "Add a use case."),
    description: trimmed(400, "The description").min(1, "Add a short description."),
    template: trimmed(2000, "The guideline text").min(20, "Write the guideline text (at least 20 characters)."),
    recommended: z.object({
      aspect: z.enum(ASPECT_RATIOS),
      quality: z.enum(QUALITIES),
      tip: trimmed(200, "The tip"),
    }),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, "Nothing to update.");

/** First human-readable message from a Zod error. */
export function firstIssue(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Something in this request isn’t valid.";
}

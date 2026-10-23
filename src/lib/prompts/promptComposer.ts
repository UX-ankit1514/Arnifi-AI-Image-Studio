import { BRAND_RULES, NO_TEXT_RULE_ID } from "@/data/brandRules";
import type { AspectRatio, Background, GenerationOptions } from "@/types/generation";
import type { Placeholder, PromptTemplate } from "@/types/prompt";

/*
 * Prompt composition (PRD §11 "Prompt System Rules", §14.4). Three layers, most important first:
 *   1. the person's request — always wins,
 *   2. the selected guideline (optional), placeholders filled from the form or pointed back at the request,
 *   3. Arnifi visual rules (optional), each one yielding to the request.
 * Output settings are appended in plain words. Pure functions: the same input always gives the same prompt, so
 * "Copy Prompt" copies exactly what Generate sends.
 */

const PLACEHOLDER = /\[([A-Z][A-Z0-9 /&,'-]*[A-Z0-9])\]/g;

export function extractPlaceholders(template: string): Placeholder[] {
  const seen = new Set<string>();
  const out: Placeholder[] = [];
  for (const match of template.matchAll(PLACEHOLDER)) {
    const key = match[1];
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ key, label: placeholderLabel(key) });
  }
  return out;
}

/** "LOCATION / BUILDING TYPE" → "Location / building type". */
export function placeholderLabel(key: string): string {
  const lower = key.toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

/**
 * Fills [PLACEHOLDER]s. An empty slot is pointed back at the request instead of being dropped or invented, so the
 * guideline never adds default imagery the person didn't ask for (PRD §14.4).
 */
export function fillTemplate(template: string, values: Record<string, string>, kind: "generate" | "edit" = "generate"): string {
  return template.replace(PLACEHOLDER, (_, key: string) => {
    const value = values[key]?.trim();
    if (value) return value;
    if (kind === "edit" && /CHANGE/.test(key)) return "making the change described in the edit request";
    return `the ${key.toLowerCase()} described in the request`;
  });
}

/** True when the request itself asks for words in the picture, so the "no text" rule would contradict it. */
export function requestsText(request: string): boolean {
  if (/["“”'‘’][^"“”'‘’]{2,}["“”'‘’]/.test(request)) return true;
  return /\b(add|include|with|put|write|show|place|display|reading|saying|says)\b[^.]{0,40}\b(text|headline|heading|caption|words?|title|lettering|label|slogan|tagline|logo)\b/i.test(
    request,
  );
}

const ASPECT_WORDS: Record<AspectRatio, string> = {
  square: "Square format (1:1).",
  portrait: "Portrait format (2:3), taller than it is wide.",
  landscape: "Landscape format (3:2), wider than it is tall.",
};

const BACKGROUND_WORDS: Record<Background, string | null> = {
  normal: null,
  transparent: "Transparent background: isolate the subject with no backdrop.",
};

export interface ComposeInput {
  mode: "generate" | "edit";
  /** The brief (generate) or the edit instruction (edit). */
  request: string;
  template: PromptTemplate | null;
  placeholders?: Record<string, string>;
  applyBrandRules: boolean;
  /** Settings the provider actually supports; unsupported ones must already be removed by the caller. */
  options?: Partial<GenerationOptions>;
}

export interface ComposedPrompt {
  prompt: string;
  /** For the "See full prompt" view and tests. */
  sections: { label: string; body: string }[];
  /** Brand rules left out because the request contradicts them. */
  skippedRules: string[];
}

export function composePrompt(input: ComposeInput): ComposedPrompt {
  const request = input.request.trim();
  const sections: { label: string; body: string }[] = [];
  const skippedRules: string[] = [];

  sections.push({
    label: input.mode === "edit" ? "EDIT REQUEST (follow this first — it overrides anything below)" : "REQUEST (follow this first — it overrides anything below)",
    body: request,
  });

  if (input.template) {
    sections.push({
      label: `${input.mode === "edit" ? "EDITING" : "STYLE"} GUIDELINE — ${input.template.title}`,
      body: fillTemplate(input.template.template, input.placeholders ?? {}, input.mode),
    });
  }

  if (input.applyBrandRules) {
    const rules = BRAND_RULES.filter((rule) => {
      if (input.mode === "edit" && rule.generateOnly) return false;
      if (rule.id === NO_TEXT_RULE_ID && requestsText(request)) {
        skippedRules.push(rule.id);
        return false;
      }
      return true;
    });
    sections.push({
      label: "ARNIFI VISUAL RULES (apply unless the request asks otherwise)",
      body: rules.map((r) => `- ${r.text}`).join("\n"),
    });
  }

  const output: string[] = [];
  if (input.mode === "generate" && input.options?.aspect) output.push(ASPECT_WORDS[input.options.aspect]);
  if (input.mode === "edit") output.push("Keep the original framing and aspect ratio unless the edit request says otherwise.");
  const bg = input.options?.background ? BACKGROUND_WORDS[input.options.background] : null;
  if (bg) output.push(bg);
  if (output.length) sections.push({ label: "OUTPUT", body: output.join("\n") });

  const prompt = sections.map((s) => `${s.label}:\n${s.body}`).join("\n\n");
  return { prompt, sections, skippedRules };
}

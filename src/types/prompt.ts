import type { AspectRatio, Quality } from "./generation";

/* Prompt guidelines (PRD §10, §11). Stored separately from the person's brief and combined at generation time. */

export const PROMPT_GROUPS = ["People & Business", "Places", "Backgrounds", "Products", "Editing"] as const;
export type PromptGroup = (typeof PROMPT_GROUPS)[number];

export interface PromptTemplate {
  id: string;
  /** Display order, 1–9. */
  order: number;
  title: string;
  useCase: string;
  group: PromptGroup;
  /** Plain-language summary, no AI jargon. */
  description: string;
  /** Reusable direction with [PLACEHOLDER] slots. */
  template: string;
  /** Example values shown as hints in the placeholder fields. */
  examples: Record<string, string>;
  recommended: { aspect: AspectRatio; quality: Quality; tip: string };
  /** Generation guidelines open in Generate Image; editing guidelines open in Edit Image. */
  kind: "generate" | "edit";
  /** False once someone has changed it in the Prompt Library. */
  isDefault: boolean;
  updatedAt: string | null;
}

export interface TemplatePatch {
  title?: string;
  useCase?: string;
  description?: string;
  template?: string;
  recommended?: PromptTemplate["recommended"];
}

export interface Placeholder {
  /** The text between the brackets, e.g. "LOCATION / BUILDING TYPE". */
  key: string;
  /** Sentence-case label for the form, e.g. "Location / building type". */
  label: string;
}

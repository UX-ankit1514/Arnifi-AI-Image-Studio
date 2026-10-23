import type { PromptTemplate } from "@/types/prompt";

/*
 * The nine starting guidelines (PRD §11). They are suggested defaults, not approved Arnifi prompts: the PRD's base
 * directions, refined with the Arnifi visual DNA from the arnifi-image-prompt skill (cool clean light, believable
 * materials, no text or marks). Seeded into Firestore `promptTemplates` and editable from the Prompt Library, so the
 * UI never hard-codes them.
 */
type DefaultTemplate = Omit<PromptTemplate, "isDefault" | "updatedAt">;

export const DEFAULT_TEMPLATES: DefaultTemplate[] = [
  {
    id: "corporate-photography",
    order: 1,
    title: "Corporate Photography",
    useCase: "Website and marketing visuals featuring professionals",
    group: "People & Business",
    description: "Realistic, premium photos of people at work — natural expressions, clean modern offices, soft light.",
    template:
      "Create realistic, premium corporate photography featuring [SUBJECT] in [LOCATION]. Use natural expressions, professional styling, realistic materials, soft lighting, and a clean contemporary environment. Avoid exaggerated cinematic effects, excessive visual clutter, and artificial-looking skin textures.",
    examples: { SUBJECT: "a young entrepreneur reviewing a contract", LOCATION: "a modern Dubai office" },
    recommended: { aspect: "landscape", quality: "high", tip: "Say where any empty space for text should go, e.g. “empty space on the left”." },
    kind: "generate",
  },
  {
    id: "uae-architecture",
    order: 2,
    title: "UAE Architecture",
    useCase: "UAE business setup and jurisdiction visuals",
    group: "Places",
    description: "Modern UAE buildings and business districts, shot like premium architectural photography.",
    template:
      "Create a realistic, modern architectural image of [LOCATION / BUILDING TYPE] in the UAE. Use clean compositions, subtle daylight or blue hour, accurate architectural proportions, corrected verticals, restrained colors, and a premium corporate photography style.",
    examples: { "LOCATION / BUILDING TYPE": "the business towers of Dubai Marina" },
    recommended: { aspect: "landscape", quality: "high", tip: "Name the area or free zone so the buildings feel specific." },
    kind: "generate",
  },
  {
    id: "minimal-marketing-background",
    order: 3,
    title: "Minimal Marketing Background",
    useCase: "Social media creative backgrounds",
    group: "Backgrounds",
    description: "Calm, uncluttered backgrounds with clear empty space where headlines and logos will go.",
    template:
      "Create a clean, minimal background featuring [SUBJECT]. Leave clear negative space at [POSITION] for marketing content. Use a modern, professional aesthetic with controlled lighting, restrained details, and balanced visual hierarchy.",
    examples: { SUBJECT: "a softly lit desk with a laptop and a plant", POSITION: "the left third of the frame" },
    recommended: { aspect: "square", quality: "standard", tip: "Use Square for posts and Portrait for stories." },
    kind: "generate",
  },
  {
    id: "product-visual",
    order: 4,
    title: "Product Visual",
    useCase: "Catalog and service visuals",
    group: "Products",
    description: "Studio-style shots of a product or object on a clean surface, with soft shadows.",
    template:
      "Create a premium commercial image featuring [PRODUCT / OBJECT]. Use realistic materials, soft shadows, clean surfaces, neutral styling, and a professional studio composition. Keep the product as the primary visual focus.",
    examples: { "PRODUCT / OBJECT": "a trade licence folder with a fountain pen" },
    recommended: { aspect: "square", quality: "high", tip: "Describe the surface and background colour you want." },
    kind: "generate",
  },
  {
    id: "banking-finance",
    order: 5,
    title: "Banking & Finance",
    useCase: "Business banking, accounting and finance services",
    group: "People & Business",
    description: "Polished business scenes for banking, accounting and finance — clean, calm and trustworthy.",
    template:
      "Create a realistic conceptual image representing [BANKING / FINANCE TOPIC]. Use sophisticated business imagery, clean compositions, subtle visual metaphors, and a professional modern corporate aesthetic.",
    examples: { "BANKING / FINANCE TOPIC": "opening a corporate bank account in the UAE" },
    recommended: { aspect: "landscape", quality: "high", tip: "Ask for real objects (statements, a calculator, a bank desk) rather than charts." },
    kind: "generate",
  },
  {
    id: "business-setup",
    order: 6,
    title: "Business Setup",
    useCase: "Company formation campaigns",
    group: "People & Business",
    description: "Confident, simple scenes about starting a company, with natural interactions and tidy surroundings.",
    template:
      "Create a premium, realistic image showing [BUSINESS ACTIVITY / ENTREPRENEUR SCENARIO] in [COUNTRY]. The image should communicate confidence, simplicity, and professionalism through natural interactions and uncluttered surroundings.",
    examples: { "BUSINESS ACTIVITY / ENTREPRENEUR SCENARIO": "a founder signing incorporation documents", COUNTRY: "the UAE" },
    recommended: { aspect: "landscape", quality: "high", tip: "Mention the country so the setting feels local." },
    kind: "generate",
  },
  {
    id: "blog-hero-image",
    order: 7,
    title: "Blog Hero Image",
    useCase: "Blog headers and editorial imagery",
    group: "Backgrounds",
    description: "Editorial images that explain an article’s idea at a glance, with room for the page title.",
    template:
      "Create a premium editorial image illustrating [ARTICLE TOPIC]. Prioritize a clear visual concept, realistic details, relevant subject matter, balanced composition, and sufficient room for page content.",
    examples: { "ARTICLE TOPIC": "how to choose between a free zone and a mainland licence" },
    recommended: { aspect: "landscape", quality: "standard", tip: "Paste the article title into the brief." },
    kind: "generate",
  },
  {
    id: "existing-image-modification",
    order: 8,
    title: "Existing Image Modification",
    useCase: "Editing previously created visuals",
    group: "Editing",
    description: "Change one thing in an image while keeping the composition, people and lighting as close as possible.",
    template:
      "Edit the provided image by [DESCRIBE CHANGE]. Preserve the overall composition, subject characteristics, lighting direction, and other relevant visual details as closely as possible. Avoid unrelated modifications.",
    examples: { "DESCRIBE CHANGE": "making the background slightly brighter" },
    recommended: { aspect: "landscape", quality: "high", tip: "Ask for one change at a time — it keeps the rest closer to the original." },
    kind: "edit",
  },
  {
    id: "background-replacement",
    order: 9,
    title: "Background Replacement / Cleanup",
    useCase: "Background changes and image refinement",
    group: "Editing",
    description: "Replace or simplify the background while keeping the main subject, shadows and perspective believable.",
    template:
      "Use the supplied image as a reference. Replace or simplify [BACKGROUND AREA] while preserving [MAIN SUBJECT]. Maintain realistic shadows, consistent perspective, natural lighting, and visually coherent edges.",
    examples: { "BACKGROUND AREA": "the office behind the desk", "MAIN SUBJECT": "the person and the desk" },
    recommended: { aspect: "landscape", quality: "high", tip: "Describe the new background in a few words, e.g. “a soft grey studio wall”." },
    kind: "edit",
  },
];

export const EDIT_TEMPLATE_BY_MODE = {
  general: "existing-image-modification",
  background: "background-replacement",
} as const;

export function defaultTemplate(id: string): PromptTemplate | null {
  const t = DEFAULT_TEMPLATES.find((d) => d.id === id);
  return t ? { ...t, isDefault: true, updatedAt: null } : null;
}

export function allDefaultTemplates(): PromptTemplate[] {
  return DEFAULT_TEMPLATES.map((t) => ({ ...t, isDefault: true, updatedAt: null }));
}

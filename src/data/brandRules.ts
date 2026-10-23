/*
 * Layer 1 of every prompt (PRD §14.4): Arnifi's image rules, condensed from the "Gulf Architectural Visual DNA" in the
 * arnifi-image-prompt skill. The card-only rules there (a quiet lower-left third for the white headline, 3:2 framing) are
 * left out: Image Studio makes images for many uses and must not force one layout or style (PRD §8.4).
 *
 * Every rule yields to the person's request — the composer says so, and drops the no-text rule when text is asked for.
 */

export interface BrandRule {
  id: string;
  text: string;
  /** Rules that only make sense for brand-new images, not for edits of an existing picture. */
  generateOnly?: boolean;
}

export const NO_TEXT_RULE_ID = "no-text";

export const BRAND_RULES: BrandRule[] = [
  {
    id: "realism",
    text: "Photorealistic and physically believable, like premium commercial photography — not CGI, illustration or painterly, unless the request asks for that.",
    generateOnly: true,
  },
  {
    id: "light",
    text: "Clean premium daylight or blue hour with a cool, neutral colour grade; avoid heavy golden or orange washes unless warmth is requested.",
    generateOnly: true,
  },
  {
    id: "colour",
    text: "Moderate saturation, shadows that keep their detail, no crushed blacks, no fake HDR, no neon.",
  },
  {
    id: "materials",
    text: "Convincing materials — glass, polished steel, stone, wood, greenery — and calm, uncluttered compositions.",
    generateOnly: true,
  },
  {
    id: "people",
    text: "People look natural, with real skin texture and relaxed expressions; in architectural scenes they stay small and secondary.",
  },
  {
    id: NO_TEXT_RULE_ID,
    text: "No added text, letters, numbers, logos, watermarks, badges, icons, UI elements or readable signage; keep any document writing out of focus or turned away.",
  },
  {
    id: "avoid",
    text: "Avoid warped architecture, duplicated buildings, broken reflections, plastic skin and cartoon styling.",
  },
];

import { describe, expect, it } from "vitest";
import { BRAND_RULES } from "@/data/brandRules";
import { allDefaultTemplates, DEFAULT_TEMPLATES, defaultTemplate } from "@/data/promptTemplates";
import { composePrompt, extractPlaceholders, fillTemplate, placeholderLabel, requestsText } from "@/lib/prompts/promptComposer";

const corporate = defaultTemplate("corporate-photography")!;
const brief = "A professional entrepreneur standing inside a modern Dubai office, empty space on the left.";

describe("prompt library defaults (PRD §11)", () => {
  it("has nine guidelines with unique ids, 7 for generating and 2 for editing", () => {
    expect(DEFAULT_TEMPLATES).toHaveLength(9);
    expect(new Set(DEFAULT_TEMPLATES.map((t) => t.id)).size).toBe(9);
    expect(DEFAULT_TEMPLATES.filter((t) => t.kind === "edit").map((t) => t.id)).toEqual(["existing-image-modification", "background-replacement"]);
  });

  it("every guideline uses placeholders and gives an example for each", () => {
    for (const t of allDefaultTemplates()) {
      const keys = extractPlaceholders(t.template).map((p) => p.key);
      expect(keys.length, t.id).toBeGreaterThan(0);
      for (const k of keys) expect(t.examples[k], `${t.id} ${k}`).toBeTruthy();
    }
  });
});

describe("placeholders", () => {
  it("finds each placeholder once, with a readable label", () => {
    expect(extractPlaceholders("A [SUBJECT] in [LOCATION / BUILDING TYPE], again [SUBJECT]")).toEqual([
      { key: "SUBJECT", label: "Subject" },
      { key: "LOCATION / BUILDING TYPE", label: "Location / building type" },
    ]);
    expect(placeholderLabel("BANKING / FINANCE TOPIC")).toBe("Banking / finance topic");
  });

  it("fills given values and points blanks back at the request instead of inventing content", () => {
    const filled = fillTemplate("featuring [SUBJECT] in [LOCATION].", { SUBJECT: "a founder" });
    expect(filled).toBe("featuring a founder in the location described in the request.");
    expect(fillTemplate("Edit the provided image by [DESCRIBE CHANGE].", {}, "edit")).toBe("Edit the provided image by making the change described in the edit request.");
  });
});

describe("composePrompt (PRD §14.4 layers)", () => {
  it("puts the request first, then the guideline, then the rules, then output settings", () => {
    const { prompt, sections } = composePrompt({ mode: "generate", request: brief, template: corporate, applyBrandRules: true, options: { aspect: "landscape" } });
    expect(sections.map((s) => s.label.split(" ")[0])).toEqual(["REQUEST", "STYLE", "ARNIFI", "OUTPUT"]);
    expect(prompt.indexOf(brief)).toBeLessThan(prompt.indexOf("premium corporate photography"));
    expect(prompt).toContain("follow this first");
    expect(prompt).toContain("Landscape format");
  });

  it("works with no guideline and no rules — just the person's words", () => {
    const { prompt, sections } = composePrompt({ mode: "generate", request: "  a cat  ", template: null, applyBrandRules: false });
    expect(sections).toHaveLength(1);
    expect(prompt).toBe("REQUEST (follow this first — it overrides anything below):\na cat");
  });

  it("changing the guideline changes the instructions", () => {
    const a = composePrompt({ mode: "generate", request: brief, template: corporate, applyBrandRules: false }).prompt;
    const b = composePrompt({ mode: "generate", request: brief, template: defaultTemplate("uae-architecture"), applyBrandRules: false }).prompt;
    expect(a).not.toBe(b);
    expect(b).toContain("UAE Architecture");
  });

  it("drops the no-text rule when the request asks for text, so the layers never contradict", () => {
    expect(requestsText('Add the headline "Start in Dubai" at the top')).toBe(true);
    expect(requestsText("A person reads a document at a desk")).toBe(false);
    const withText = composePrompt({ mode: "generate", request: 'Include the words "Open Now" on the sign', template: null, applyBrandRules: true });
    expect(withText.skippedRules).toEqual(["no-text"]);
    expect(withText.prompt).not.toContain("No added text");
    const plain = composePrompt({ mode: "generate", request: brief, template: null, applyBrandRules: true });
    expect(plain.prompt).toContain("No added text");
  });

  it("edit prompts keep only the rules that make sense for an existing picture", () => {
    const { prompt } = composePrompt({ mode: "edit", request: "Make the background lighter", template: defaultTemplate("existing-image-modification"), applyBrandRules: true });
    for (const rule of BRAND_RULES.filter((r) => r.generateOnly)) expect(prompt).not.toContain(rule.text);
    expect(prompt).toContain("Keep the original framing");
    expect(prompt).toContain("making the change described in the edit request");
  });

  it("is deterministic, so Copy Prompt matches what is sent", () => {
    const input = { mode: "generate" as const, request: brief, template: corporate, placeholders: { SUBJECT: "a founder" }, applyBrandRules: true, options: { aspect: "square" as const } };
    expect(composePrompt(input).prompt).toBe(composePrompt(input).prompt);
  });
});

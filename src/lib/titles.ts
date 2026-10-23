const MINOR = new Set(["a", "an", "the", "of", "in", "on", "at", "with", "and", "for", "to", "by", "or"]);

/** A short title from a brief: the subject, Title Case, no trailing full stop (DS copy rules). */
export function titleFromText(text: string, fallback: string): string {
  const subject = text
    .trim()
    .replace(/^(?:please\s+)?(?:create|generate|make|design|draw|edit|show)\s+/i, "")
    .replace(/^(?:(?:a|an|the|premium|realistic|photorealistic|clean|minimal|modern|simple|high[- ]quality|professional-looking)\s+)*(?:image|photo|photograph|picture|illustration|visual|background|shot|scene)\s+(?:of|showing|featuring|with)\s+/i, "")
    .replace(/^(?:an?|the)\s+/i, "")
    .split(/[.,;:\n]/)[0]
    .trim();
  const words = subject.split(/\s+/).filter(Boolean).slice(0, 8);
  if (!words.length) return fallback;
  return words
    .map((w, i) => (i > 0 && MINOR.has(w.toLowerCase()) ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(" ")
    .slice(0, 80);
}

import "server-only";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { z } from "zod";

/* The starting library (seed/manifest.json): read by `npm run seed` and by the demo-fixture store. */

const entry = z.object({
  source: z.string().min(1),
  title: z.string().min(1),
  category: z.string().min(1),
  tags: z.array(z.string()).default([]),
  usageContext: z.string().nullable().default(null),
});
const manifest = z.object({ root: z.string(), images: z.array(entry) });

export type SeedEntry = z.infer<typeof entry> & { path: string; fixtureId: string };

export function loadSeedManifest(file = join(process.cwd(), "seed", "manifest.json")): SeedEntry[] {
  const parsed = manifest.parse(JSON.parse(readFileSync(/*turbopackIgnore: true*/ file, "utf8")));
  const root = parsed.root.startsWith("~/") ? join(homedir(), parsed.root.slice(2)) : resolve(parsed.root);
  return parsed.images.map((e) => ({
    ...e,
    path: join(root, e.source),
    fixtureId: `fx_${createHash("sha1").update(e.source).digest("hex").slice(0, 12)}`,
  }));
}

export const SEED_NOTE = "Imported from the existing Arnifi photo archive used for arnifi.com listing cards.";
export const SEED_ATTRIBUTION = "Arnifi listing-card archive";

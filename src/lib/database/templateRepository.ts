import "server-only";
import { allDefaultTemplates, defaultTemplate } from "@/data/promptTemplates";
import type { PromptTemplate, TemplatePatch } from "@/types/prompt";
import { COLLECTIONS, getDb, hasStorage, StorageUnavailableError } from "./firestore";

/*
 * Prompt guidelines (PRD §11, §18.1). The nine defaults live in src/data/promptTemplates.ts; changes made in the Prompt
 * Library are stored in Firestore `promptTemplates/{id}` and laid over the default. "Reset to default" deletes the
 * override. The UI only ever reads guidelines from here.
 */

const CACHE_MS = 60_000;
let cache: { at: number; overrides: Map<string, TemplatePatch & { updatedAt: string }> } | null = null;

async function overrides() {
  if (!hasStorage()) return new Map<string, TemplatePatch & { updatedAt: string }>();
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.overrides;
  try {
    const snap = await getDb().collection(COLLECTIONS.templates).get();
    cache = { at: Date.now(), overrides: new Map(snap.docs.map((d) => [d.id, d.data() as TemplatePatch & { updatedAt: string }])) };
  } catch {
    // Guidelines must stay usable even if Firestore is briefly unreachable: fall back to the defaults.
    return new Map();
  }
  return cache.overrides;
}

function apply(base: PromptTemplate, o: (TemplatePatch & { updatedAt: string }) | undefined): PromptTemplate {
  if (!o) return base;
  return {
    ...base,
    title: o.title ?? base.title,
    useCase: o.useCase ?? base.useCase,
    description: o.description ?? base.description,
    template: o.template ?? base.template,
    recommended: o.recommended ?? base.recommended,
    isDefault: false,
    updatedAt: o.updatedAt ?? null,
  };
}

/** Tests only. */
export function resetTemplateCache() {
  cache = null;
}

export async function listTemplates(): Promise<PromptTemplate[]> {
  const o = await overrides();
  return allDefaultTemplates().map((t) => apply(t, o.get(t.id)));
}

export async function getTemplate(id: string): Promise<PromptTemplate | null> {
  const base = defaultTemplate(id);
  if (!base) return null;
  return apply(base, (await overrides()).get(id));
}

export async function updateTemplate(id: string, patch: TemplatePatch): Promise<PromptTemplate> {
  if (!defaultTemplate(id)) throw new Error("Unknown guideline");
  if (!hasStorage()) throw new StorageUnavailableError("Changing guidelines needs saving to be set up. See Settings.");
  const ref = getDb().collection(COLLECTIONS.templates).doc(id);
  const updatedAt = new Date().toISOString();
  await ref.set({ ...patch, updatedAt }, { merge: true });
  cache = null;
  return (await getTemplate(id))!;
}

export async function resetTemplate(id: string): Promise<PromptTemplate> {
  if (!defaultTemplate(id)) throw new Error("Unknown guideline");
  if (!hasStorage()) throw new StorageUnavailableError("Changing guidelines needs saving to be set up. See Settings.");
  await getDb().collection(COLLECTIONS.templates).doc(id).delete();
  cache = null;
  return defaultTemplate(id)!;
}

/*
 * npm run seed — copies the starting photos listed in seed/manifest.json into the library (Firestore), once.
 * The originals are only read. Running it again skips photos already imported (tracked in `seeds/{id}`).
 * Uses the same storage code as the app, so seeded images look exactly like uploads (source: Uploaded).
 */
import { readFile } from "node:fs/promises";
import { getDb, storageConfig } from "@/lib/database/firestore";
import { FirestoreImageStore } from "@/lib/database/imageRepository";
import { loadSeedManifest, SEED_ATTRIBUTION, SEED_NOTE } from "@/lib/database/seedManifest";
import { inspectImage } from "@/lib/validation/files";

async function main() {
  const cfg = storageConfig();
  if (cfg.mode === "none") {
    console.error(`✖ ${cfg.reason}\n  Add the Firebase key (see README → "Connect storage"), or run against the emulator: npx firebase emulators:exec --only firestore "npm run seed"`);
    process.exit(1);
  }
  console.log(`Seeding the library in ${cfg.mode === "emulator" ? "the local emulator" : `Firestore project “${cfg.projectId}”`}…`);
  const db = getDb();
  const store = new FirestoreImageStore(db);
  let added = 0;
  let skipped = 0;
  for (const entry of loadSeedManifest()) {
    const marker = db.collection("seeds").doc(entry.fixtureId);
    if ((await marker.get()).exists) {
      skipped++;
      continue;
    }
    let bytes: Buffer;
    try {
      bytes = await readFile(entry.path);
    } catch {
      console.warn(`  ! missing, skipped: ${entry.source}`);
      continue;
    }
    const info = await inspectImage(bytes, { maxBytes: 40 * 1024 * 1024 });
    const record = await store.create(
      {
        title: entry.title,
        category: entry.category,
        tags: entry.tags,
        sourceType: "uploaded",
        prompt: null,
        finalPrompt: null,
        promptTemplateId: null,
        promptTemplateTitle: null,
        provider: null,
        model: null,
        parentImageId: null,
        rootImageId: null,
        version: 1,
        notes: SEED_NOTE,
        campaign: null,
        usageContext: entry.usageContext,
        owner: null,
        attribution: SEED_ATTRIBUTION,
        seeded: true,
      },
      bytes,
      info,
    );
    await marker.set({ imageId: record.id, source: entry.source, at: new Date().toISOString() });
    added++;
    console.log(`  ✓ ${record.title} (${info.width} × ${info.height}, ${(info.size / 1e6).toFixed(1)} MB)`);
  }
  console.log(`Done: ${added} added, ${skipped} already in the library.`);
}

main().catch((e) => {
  console.error("✖ Seeding failed:", e instanceof Error ? e.message : e);
  process.exit(1);
});

import "server-only";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

/*
 * Firestore connection (server only — the browser never talks to Firestore; the rules deny all client access).
 * Three modes:
 *   emulator  — FIRESTORE_EMULATOR_HOST is set (tests, `npm run dev:emulator`); never touches the real project
 *   firestore — a service-account key file is configured (the real "Arnifi Image Studio" project)
 *   none      — no key yet: the library shows read-only demo fixtures and saving is switched off (PRD §16.5)
 */

export const COLLECTIONS = {
  images: "images",
  blobs: "blobs",
  chunks: "chunks",
  thumbs: "thumbs",
  templates: "promptTemplates",
  jobs: "jobs",
  usage: "usage",
} as const;

export type StorageMode = "emulator" | "firestore" | "none";

export interface StorageConfig {
  mode: StorageMode;
  projectId: string | null;
  /** Why storage is off, in plain words. */
  reason: string | null;
}

const DEFAULT_KEY_PATH = join(homedir(), ".config", "arnifi-image-studio", "firebase-sa.json");

function expandHome(p: string): string {
  return p.startsWith("~/") ? join(homedir(), p.slice(2)) : p;
}

function keyPath(): string | null {
  const configured = process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim();
  const path = configured ? expandHome(configured) : DEFAULT_KEY_PATH;
  return existsSync(path) ? path : null;
}

export function storageConfig(): StorageConfig {
  const projectId = process.env.FIREBASE_PROJECT_ID?.trim() || null;
  if (process.env.FIRESTORE_EMULATOR_HOST) {
    return { mode: "emulator", projectId: projectId ?? "demo-image-studio", reason: null };
  }
  if (process.env.STUDIO_STORAGE === "none") return { mode: "none", projectId, reason: "Storage is switched off for this run." };
  if (!keyPath()) {
    return {
      mode: "none",
      projectId: projectId ?? "arnifi-image-studio",
      reason: "The Firebase key file isn’t on this computer yet, so images can’t be saved.",
    };
  }
  return { mode: "firestore", projectId: projectId ?? "arnifi-image-studio", reason: null };
}

export class StorageUnavailableError extends Error {
  constructor(message = "Saving isn’t set up yet: the Firebase key file is missing. See Settings.") {
    super(message);
    this.name = "StorageUnavailableError";
  }
}

const g = globalThis as unknown as { __studioDb?: Firestore };

export function getDb(): Firestore {
  if (g.__studioDb) return g.__studioDb;
  const cfg = storageConfig();
  if (cfg.mode === "none") throw new StorageUnavailableError();
  let app: App;
  const existing = getApps().find((a) => a.name === "image-studio");
  if (existing) app = existing;
  else if (cfg.mode === "emulator") {
    // Saves the Google client from probing the cloud metadata server for a project id (a noisy warning locally).
    process.env.GOOGLE_CLOUD_PROJECT ??= cfg.projectId!;
    app = initializeApp({ projectId: cfg.projectId! }, "image-studio");
  }
  else app = initializeApp({ credential: cert(keyPath()!), projectId: cfg.projectId! }, "image-studio");
  const db = getFirestore(app);
  db.settings({ ignoreUndefinedProperties: true });
  g.__studioDb = db;
  return db;
}

export function hasStorage(): boolean {
  return storageConfig().mode !== "none";
}

/** One cheap read to prove the connection and permissions work (Settings screen). */
export async function checkStorage(): Promise<{ ok: boolean; detail: string }> {
  const cfg = storageConfig();
  if (cfg.mode === "none") return { ok: false, detail: cfg.reason ?? "Storage isn’t configured." };
  try {
    await getDb().collection(COLLECTIONS.images).limit(1).get();
    return { ok: true, detail: cfg.mode === "emulator" ? "Connected to the local test database (emulator)." : `Connected to Firestore project “${cfg.projectId}”.` };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/PERMISSION_DENIED|permission/i.test(msg)) return { ok: false, detail: "The Firebase key was rejected. Download a new key from the Firebase console." };
    return { ok: false, detail: "Firestore can’t be reached right now. Check the internet connection." };
  }
}

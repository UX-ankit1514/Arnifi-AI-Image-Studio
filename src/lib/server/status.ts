import "server-only";
import { getProvider, isTestMode } from "@/lib/ai";
import { checkStorage, storageConfig } from "@/lib/database/firestore";
import { usageLimits, usageToday } from "@/lib/security/rateLimit";
import type { StudioStatus } from "@/types/status";

/* Everything the Settings screen and the header status pill show (PRD §6 "Settings / Connection Status"). */
export async function studioStatus(force = false): Promise<StudioStatus> {
  const provider = getProvider();
  const cfg = storageConfig();
  const [ai, storage, usage] = await Promise.all([provider.status(force), checkStorage(), usageToday()]);
  return {
    ai,
    options: provider.getSupportedOptions(),
    storage: { mode: cfg.mode, projectId: cfg.projectId, ok: storage.ok, detail: storage.detail },
    usage: { ...usage, perSessionPerHour: usageLimits().perSessionPerHour },
    testMode: isTestMode(),
    passcode: Boolean(process.env.STUDIO_PASSCODE?.trim()),
  };
}

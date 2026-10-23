import type { ProviderStatus, SupportedOptions } from "@/lib/ai/imageProvider";

export interface StudioStatus {
  ai: ProviderStatus;
  options: SupportedOptions;
  storage: { mode: "emulator" | "firestore" | "none"; projectId: string | null; ok: boolean; detail: string };
  usage: { date: string; used: number; limit: number; perSessionPerHour: number };
  testMode: boolean;
  passcode: boolean;
  /** Running on Vercel (the live site) rather than on a Mac. */
  hosted: boolean;
  /** local = this server runs Codex itself; helper = a helper Mac makes the images. */
  mode: "local" | "helper";
}

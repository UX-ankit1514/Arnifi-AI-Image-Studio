import "server-only";
import { providerId } from "@/lib/mode";
import { CurvetProvider } from "./curvetProvider";
import type { ImageProvider } from "./imageProvider";
import { MockProvider } from "./mockProvider";

/* Picks the image provider: Curvet (GPT Image). The test provider exists only for automated tests. */

const g = globalThis as unknown as { __imageProvider?: { key: string; provider: ImageProvider } };

export function isTestMode(): boolean {
  return process.env.STUDIO_TEST_MODE === "1";
}

export function getProvider(): ImageProvider {
  const wanted = providerId();
  // The test provider makes test patterns; never let it stand in for real AI outside automated tests.
  const key = wanted === "mock" && isTestMode() ? "mock" : "curvet";
  if (g.__imageProvider?.key === key) return g.__imageProvider.provider;
  const provider: ImageProvider = key === "mock" ? new MockProvider() : new CurvetProvider();
  g.__imageProvider = { key, provider };
  return provider;
}

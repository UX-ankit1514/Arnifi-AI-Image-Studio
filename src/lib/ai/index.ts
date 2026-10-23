import "server-only";
import { providerId } from "@/lib/mode";
import { CodexProvider } from "./codexProvider";
import { HelperProvider } from "./helperProvider";
import type { ImageProvider } from "./imageProvider";
import { MockProvider } from "./mockProvider";
import { OpenAIProvider } from "./openaiProvider";

/* Picks the configured provider (IMAGE_PROVIDER). One instance per server process. */

const g = globalThis as unknown as { __imageProvider?: { key: string; provider: ImageProvider } };

export function isTestMode(): boolean {
  return process.env.STUDIO_TEST_MODE === "1";
}

export function getProvider(): ImageProvider {
  const wanted = providerId();
  // The test provider makes test patterns; never let it stand in for real AI outside automated tests.
  const key = wanted === "mock" && !isTestMode() ? "codex" : wanted;
  if (g.__imageProvider?.key === key) return g.__imageProvider.provider;
  const provider: ImageProvider = key === "openai" ? new OpenAIProvider() : key === "mock" ? new MockProvider() : key === "helper" ? new HelperProvider() : new CodexProvider();
  g.__imageProvider = { key, provider };
  return provider;
}

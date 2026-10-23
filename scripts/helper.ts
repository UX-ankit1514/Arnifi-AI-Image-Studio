/*
 * npm run helper — the helper Mac for the live site (https://arnifi-ai-image.vercel.app).
 *
 * Vercel's servers can't run Codex or use a ChatGPT sign-in, so the website queues image requests in Firestore and this
 * program — on a Mac that's signed in to Codex with ChatGPT — makes them and sends the results back. Keep it running
 * (and the Mac awake) whenever people should be able to generate or edit images on the live site.
 */
process.env.IMAGE_PROVIDER = "helper"; // results go to Firestore, where the website can read them

import { createHash } from "node:crypto";
import { hostname } from "node:os";
import { CodexProvider } from "@/lib/ai/codexProvider";
import { MockProvider } from "@/lib/ai/mockProvider";
import { getDb, storageConfig } from "@/lib/database/firestore";
import { HelperWorker } from "@/lib/helper/worker";

const time = () => new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
const say = (message: string) => console.log(`[${time()}] ${message}`);

async function main() {
  const storage = storageConfig();
  if (storage.mode === "none") {
    console.error(`✖ ${storage.reason}\n  Put the Firebase key at ~/.config/arnifi-image-studio/firebase-sa.json (README → “Connect storage”), then start the helper again.`);
    process.exit(1);
  }
  const test = process.env.STUDIO_TEST_MODE === "1" && process.env.HELPER_PROVIDER === "mock";
  const provider = test ? new MockProvider() : new CodexProvider();
  const codex = await provider.status(true);
  const host = hostname().replace(/\.local$/, "");
  const helperId = `mac-${createHash("sha1").update(hostname()).digest("hex").slice(0, 10)}`;

  console.log("\nArnifi Image Studio — helper Mac\n");
  say(`Database: ${storage.mode === "emulator" ? "local test database (emulator)" : `Firestore “${storage.projectId}”`}`);
  say(`ChatGPT: ${codex.detail}`);
  if (!codex.ready) {
    say("⚠ Codex isn’t ready, so requests would fail. In another Terminal window run: codex login (choose “Sign in with ChatGPT”). The helper keeps running and notices within a minute.");
  }

  const worker = new HelperWorker(getDb(), provider, { helperId, hostname: host, log: say });
  await worker.start();
  say(`✓ Helper is running on “${host}”. Leave this window open and the Mac awake. Press Ctrl-C to stop.\n`);

  const shutdown = async () => {
    say("Stopping the helper…");
    await worker.stop();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((e) => {
  console.error("✖ The helper couldn’t start:", e instanceof Error ? e.message : e);
  process.exit(1);
});

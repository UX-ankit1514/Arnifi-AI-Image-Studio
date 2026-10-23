/*
 * npm run test:live — the "real provider" check (PRD §25): one real generation and one real edit through the configured
 * provider (by default ChatGPT via Codex), with the same code the app uses. It uses your ChatGPT plan (2 images, about
 * 2–4 minutes) and saves nothing to the library. Results are written to .data/live-check/ so you can look at them.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { getProvider } from "@/lib/ai";
import { ProviderError } from "@/lib/ai/imageProvider";
import { normalizeImageResult } from "@/lib/ai/normalize";
import { defaultTemplate } from "@/data/promptTemplates";
import { composePrompt } from "@/lib/prompts/promptComposer";

async function main() {
  const provider = getProvider();
  const status = await provider.status(true);
  console.log(`Provider: ${status.label} · model ${status.model}\n${status.detail}`);
  if (!status.ready) {
    console.error(`✖ Not ready.\n  ${status.fix.join("\n  ")}`);
    process.exit(1);
  }
  const out = join(process.cwd(), ".data", "live-check");
  await mkdir(out, { recursive: true });
  const signal = new AbortController().signal;

  const prompt = composePrompt({
    mode: "generate",
    request: "A calm, modern Dubai business-district street at blue hour, wide open sky on the left.",
    template: defaultTemplate("uae-architecture"),
    applyBrandRules: true,
    options: { aspect: "landscape" },
  }).prompt;
  let t = Date.now();
  console.log("\n1/2 Generating…");
  const generated = await normalizeImageResult(await provider.generateImage({ prompt, options: { aspect: "landscape", quality: "standard", background: "normal" } }, signal), { aspect: "landscape" });
  await writeFile(join(out, "generated.png"), generated.bytes);
  console.log(`  ✓ ${generated.width} × ${generated.height} ${generated.format} in ${Math.round((Date.now() - t) / 1000)} s ${generated.warnings.join(" ")}`);

  t = Date.now();
  console.log("2/2 Editing…");
  const editPrompt = composePrompt({ mode: "edit", request: "Make the sky slightly warmer, keep everything else the same.", template: defaultTemplate("existing-image-modification"), applyBrandRules: true }).prompt;
  const edited = await normalizeImageResult(await provider.editImage({ prompt: editPrompt, image: { bytes: generated.bytes, format: generated.format, width: generated.width, height: generated.height } }, signal), { source: generated });
  await writeFile(join(out, "edited.png"), edited.bytes);
  console.log(`  ✓ ${edited.width} × ${edited.height} ${edited.format} in ${Math.round((Date.now() - t) / 1000)} s ${edited.warnings.join(" ")}`);
  console.log(`\nReal generation and editing work. Images: ${out}`);
}

main().catch((e) => {
  console.error(e instanceof ProviderError ? `✖ ${e.code}: ${e.message}` : `✖ ${e instanceof Error ? e.message : e}`);
  process.exit(1);
});

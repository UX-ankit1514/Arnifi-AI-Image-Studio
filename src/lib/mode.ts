/*
 * Where this copy of Image Studio runs, and how image requests are processed.
 *
 *   local  (default on a Mac)  — the server itself runs Codex, signed in with the ChatGPT plan on that Mac.
 *   helper (default on Vercel) — the website only queues requests in Firestore; a helper program on a Mac that is
 *                                signed in to ChatGPT picks them up (`npm run helper`). Vercel's servers can't run
 *                                Codex or use anyone's ChatGPT sign-in, so this is how the live site gets images.
 */
export function isHosted(): boolean {
  return process.env.VERCEL === "1" || process.env.STUDIO_HOSTED === "1";
}

export function providerId(): string {
  const wanted = process.env.IMAGE_PROVIDER?.trim().toLowerCase();
  // Codex can't run on Vercel's servers, so on the live site "codex" means "ChatGPT via the helper Mac".
  if (isHosted() && (!wanted || wanted === "codex")) return "helper";
  return wanted || "codex";
}

/** Remote jobs: queued in Firestore and processed by the helper Mac, with results stored in Firestore too. */
export function usesRemoteJobs(): boolean {
  return providerId() === "helper";
}

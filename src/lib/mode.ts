/*
 * Where this copy of Image Studio runs. Images always come from the Curvet API (GPT Image); only the bookkeeping differs:
 *   on a Mac   — requests run inside this server process; unsaved results go to the .data folder.
 *   on Vercel  — every request may reach a different server, so requests and unsaved results are kept in Firestore,
 *                and each request is processed by the server that received it, after it has answered (Next `after()`).
 */
export function isHosted(): boolean {
  return process.env.VERCEL === "1" || process.env.STUDIO_HOSTED === "1";
}

export function providerId(): string {
  return process.env.IMAGE_PROVIDER?.trim().toLowerCase() || "curvet";
}

/** Requests and unsaved results live in Firestore (the live site), not in this server's memory and disk. */
export function usesRemoteJobs(): boolean {
  return isHosted();
}

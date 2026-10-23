/*
 * Minimal internal access protection (PRD §21.1). Every browser gets an anonymous session cookie, used for per-session
 * limits. If STUDIO_PASSCODE is set, the whole app sits behind a passcode screen as well. The server also listens only
 * on 127.0.0.1 on a Mac, so nobody else on the network can use it.
 */
export const SESSION_COOKIE = "studio_sid";
export const PASS_COOKIE = "studio_pass";

export async function passToken(passcode: string): Promise<string> {
  const data = new TextEncoder().encode(`arnifi-image-studio:v1:${passcode}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

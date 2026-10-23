import "server-only";
import { COLLECTIONS, getDb, hasStorage } from "@/lib/database/firestore";
import { isOnline, pickHelper, type HelperHeartbeat } from "@/lib/helper/heartbeat";
import { codexModel, CodexProvider } from "./codexProvider";
import { ProviderError, type ImageProvider, type ProviderStatus, type SupportedOptions } from "./imageProvider";

/*
 * The live site's provider (helper mode). The website never makes images itself — Vercel's servers can't run Codex or
 * use a ChatGPT sign-in. Requests are queued in Firestore and the helper Mac (`npm run helper`, signed in to ChatGPT)
 * makes them. This class only reports whether that helper is online and ready.
 */

export const HELPER_FIX = [
  "On the Mac that is signed in to ChatGPT, open the “AI image generation” project folder.",
  "Double-click “Start Image Studio Helper.command”. A Terminal window opens and says “Helper is running”.",
  "Keep that window open and the Mac awake and online — while it runs, the live site can make images.",
  "Come back here and press Check Again.",
];

function minutesAgo(iso: string): string {
  const m = Math.round((Date.now() - Date.parse(iso)) / 60_000);
  if (m < 1) return "less than a minute ago";
  if (m < 60) return `${m} minute${m === 1 ? "" : "s"} ago`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h} hour${h === 1 ? "" : "s"} ago`;
  return `${Math.round(h / 24)} days ago`;
}

export class HelperProvider implements ImageProvider {
  readonly id = "helper";
  readonly label = "ChatGPT (via the helper Mac)";
  private cached: { at: number; status: ProviderStatus; helper: HelperHeartbeat | null } | null = null;

  model(): string {
    return this.cached?.helper?.model ?? codexModel();
  }

  /** Same abilities as Codex, because the helper runs Codex. */
  getSupportedOptions(): SupportedOptions {
    return new CodexProvider().getSupportedOptions();
  }

  async helper(force = false): Promise<HelperHeartbeat | null> {
    await this.status(force);
    return this.cached?.helper ?? null;
  }

  async status(force = false): Promise<ProviderStatus> {
    if (!force && this.cached && Date.now() - this.cached.at < 10_000) return this.cached.status;
    const base = { id: this.id, label: this.label, checkedAt: new Date().toISOString() };
    let helper: HelperHeartbeat | null = null;
    let status: ProviderStatus;
    if (!hasStorage()) {
      status = { ...base, model: codexModel(), ready: false, detail: "The live site can’t reach the helper Mac until storage (the Firebase key) is set up.", fix: ["Set up Image storage first (see the card next to this one)."] };
    } else {
      try {
        const snap = await getDb().collection(COLLECTIONS.helpers).get();
        helper = pickHelper(snap.docs.map((d) => d.data() as HelperHeartbeat));
      } catch {
        helper = null;
      }
      const model = helper?.model ?? codexModel();
      if (!helper) {
        status = { ...base, model, ready: false, detail: "No helper Mac has connected yet. The live site makes images through a helper program on a Mac that’s signed in to ChatGPT.", fix: HELPER_FIX };
      } else if (!isOnline(helper)) {
        status = { ...base, model, ready: false, detail: `The helper Mac “${helper.hostname}” is offline (last seen ${minutesAgo(helper.lastSeen)}). Images can’t be made until it’s running again.`, fix: HELPER_FIX };
      } else if (!helper.ready) {
        status = { ...base, model, ready: false, detail: `The helper Mac “${helper.hostname}” is running, but: ${helper.detail}`, fix: ["On the helper Mac, open Terminal and run: codex login — choose “Sign in with ChatGPT”.", "The helper notices within a minute. Then press Check Again."] };
      } else {
        status = { ...base, model, ready: true, detail: `Images are made by the helper Mac “${helper.hostname}” with its ChatGPT plan, about 1–2 minutes each.`, fix: [] };
      }
    }
    this.cached = { at: Date.now(), status, helper };
    return status;
  }

  async generateImage(): Promise<never> {
    throw new ProviderError("capability", "On the live site, images are made by the helper Mac, not by the website itself.");
  }

  async editImage(): Promise<never> {
    throw new ProviderError("capability", "On the live site, images are made by the helper Mac, not by the website itself.");
  }
}

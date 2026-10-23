import { afterEach, describe, expect, it } from "vitest";
import { serviceAccountFromEnv } from "@/lib/database/firestore";
import { isOnline, OFFLINE_AFTER_MS, pickHelper, type HelperHeartbeat } from "@/lib/helper/heartbeat";
import { isHosted, providerId, usesRemoteJobs } from "@/lib/mode";

const env = { ...process.env };
afterEach(() => {
  process.env = { ...env };
});

describe("where the studio runs", () => {
  it("a Mac runs Codex itself; Vercel queues for the helper Mac unless told otherwise", () => {
    delete process.env.VERCEL;
    delete process.env.IMAGE_PROVIDER;
    expect([isHosted(), providerId(), usesRemoteJobs()]).toEqual([false, "codex", false]);
    process.env.VERCEL = "1";
    expect([isHosted(), providerId(), usesRemoteJobs()]).toEqual([true, "helper", true]);
    process.env.IMAGE_PROVIDER = "codex";
    expect(providerId()).toBe("helper");
    process.env.IMAGE_PROVIDER = "openai";
    expect([providerId(), usesRemoteJobs()]).toEqual(["openai", false]);
  });
});

describe("Firebase key from the FIREBASE_SERVICE_ACCOUNT setting", () => {
  const key = { type: "service_account", project_id: "arnifi-image-studio", client_email: "x@arnifi-image-studio.iam.gserviceaccount.com", private_key: "-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----\n" };

  it("accepts the pasted JSON, base64, and keys whose line breaks became \\n", () => {
    expect(serviceAccountFromEnv(JSON.stringify(key))).toMatchObject({ projectId: "arnifi-image-studio", clientEmail: key.client_email });
    expect(serviceAccountFromEnv(Buffer.from(JSON.stringify(key)).toString("base64"))?.privateKey).toBe(key.private_key);
    const flattened = JSON.stringify({ ...key, private_key: key.private_key.replace(/\n/g, "\\n") });
    expect(serviceAccountFromEnv(flattened)?.privateKey).toBe(key.private_key);
  });

  it("rejects anything that isn't a key", () => {
    expect(serviceAccountFromEnv("")).toBeNull();
    expect(serviceAccountFromEnv("not json")).toBeNull();
    expect(serviceAccountFromEnv(JSON.stringify({ project_id: "x" }))).toBeNull();
  });
});

describe("helper Mac online status", () => {
  const beat = (id: string, agoMs: number, ready = true): HelperHeartbeat => ({ helperId: id, hostname: id, lastSeen: new Date(Date.now() - agoMs).toISOString(), startedAt: "", ready, detail: "", model: "m", busyJobId: null });

  it("is online until two heartbeats are missed", () => {
    expect(isOnline(beat("a", 1000))).toBe(true);
    expect(isOnline(beat("a", OFFLINE_AFTER_MS + 1000))).toBe(false);
    expect(isOnline(null)).toBe(false);
  });

  it("prefers a ready, online helper", () => {
    expect(pickHelper([beat("old", 10 * 60_000), beat("notready", 1000, false), beat("good", 5000)])?.helperId).toBe("good");
    expect(pickHelper([beat("old", 10 * 60_000)])?.helperId).toBe("old");
    expect(pickHelper([])).toBeNull();
  });
});

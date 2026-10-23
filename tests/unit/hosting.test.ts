import { afterEach, describe, expect, it } from "vitest";
import { serviceAccountFromEnv } from "@/lib/database/firestore";
import { isHosted, providerId, usesRemoteJobs } from "@/lib/mode";

const env = { ...process.env };
afterEach(() => {
  process.env = { ...env };
});

describe("where the studio runs", () => {
  it("images always come from Curvet; on Vercel requests are kept in Firestore", () => {
    delete process.env.VERCEL;
    delete process.env.STUDIO_HOSTED;
    delete process.env.IMAGE_PROVIDER;
    expect([isHosted(), providerId(), usesRemoteJobs()]).toEqual([false, "curvet", false]);
    process.env.VERCEL = "1";
    expect([isHosted(), providerId(), usesRemoteJobs()]).toEqual([true, "curvet", true]);
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

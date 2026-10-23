import path from "node:path";
import { defineConfig } from "vitest/config";

const alias = {
  "@": path.resolve(import.meta.dirname, "src"),
  // "server-only" throws outside React Server Components; tests import server modules directly.
  "server-only": path.resolve(import.meta.dirname, "tests/support/empty.ts"),
};

/*
 * unit: pure logic, no services. integration: runs inside `firebase emulators:exec` (npm run test:integration),
 * against the local Firestore emulator — never the real project.
 */
export default defineConfig({
  test: {
    projects: [
      {
        resolve: { alias },
        // Unit tests never touch a database, even once the real Firebase key is on this computer.
        test: { name: "unit", include: ["tests/unit/**/*.test.ts"], environment: "node", testTimeout: 20_000, env: { STUDIO_STORAGE: "none", IMAGE_PROVIDER: "mock", STUDIO_TEST_MODE: "1" } },
      },
      {
        resolve: { alias },
        test: {
          name: "integration",
          include: ["tests/integration/**/*.test.ts"],
          environment: "node",
          testTimeout: 60_000,
          fileParallelism: false,
          env: { STUDIO_TEST_MODE: "1", IMAGE_PROVIDER: "mock", FIREBASE_PROJECT_ID: "demo-image-studio" },
        },
      },
    ],
  },
});

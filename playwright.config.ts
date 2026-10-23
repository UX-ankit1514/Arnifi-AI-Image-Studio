import { defineConfig } from "@playwright/test";

const PORT = 3110;

/*
 * End-to-end journeys (PRD §25 tests A–E) against a production build, a fresh Firestore emulator seeded with the
 * starting photos, and the test provider (no paid AI calls). The real provider is checked by `npm run test:live`.
 */
export default defineConfig({
  testDir: "tests/e2e",
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    channel: "chrome",
    trace: "retain-on-failure",
    acceptDownloads: true,
  },
  projects: [
    { name: "desktop", use: { viewport: { width: 1440, height: 900 } }, grepInvert: /@mobile/ },
    { name: "mobile", use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }, grep: /@mobile/ },
  ],
  webServer: {
    command: `./node_modules/.bin/firebase emulators:exec --config firebase.e2e.json --only firestore --project demo-image-studio "npm run seed && npx next build && npx next start -H 127.0.0.1 -p ${PORT}"`,
    // Ctrl-C style stop, so the Firebase CLI shuts its emulator down instead of leaving it running.
    gracefulShutdown: { signal: "SIGINT", timeout: 20_000 },
    url: `http://127.0.0.1:${PORT}/library`,
    reuseExistingServer: false,
    timeout: 300_000,
    env: {
      STUDIO_TEST_MODE: "1",
      IMAGE_PROVIDER: "mock",
      MOCK_PROVIDER_DELAY_MS: "1200",
      STUDIO_DATA_DIR: ".data/e2e",
      FIREBASE_PROJECT_ID: "demo-image-studio",
      MAX_REQUESTS_PER_SESSION_PER_HOUR: "100",
      MAX_IMAGE_REQUESTS_PER_DAY: "200",
    },
  },
});

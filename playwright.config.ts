import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/browser",
  workers: 2,
  timeout: 60_000,
  outputDir: "test-results/visual",
  use: {
    baseURL: process.env.FUGUE_VISUAL_URL || "http://127.0.0.1:3318",
    ...(process.env.FUGUE_VISUAL_CHROME ? { channel: "chrome" } : {}),
    trace: "retain-on-failure",
  },
});

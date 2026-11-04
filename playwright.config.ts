import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests",
  testMatch: "ui.spec.ts",
  use: { baseURL: "http://127.0.0.1:5187", headless: true },
  webServer: {
    command: "npm run dev:web -- --port 5187",
    url: "http://127.0.0.1:5187",
    reuseExistingServer: false,
    timeout: 30000,
  },
});

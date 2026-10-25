import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "tests/e2e",
  workers: 1, // tests share one in-memory database
  use: { baseURL: "http://localhost:3000" },
  projects: [{ name: "mobile", use: { ...devices["Pixel 7"] } }],
  webServer: {
    command: "pnpm build && pnpm start",
    env: {
      USE_PGLITE: "1",
      BETTER_AUTH_SECRET: "e2e-only-secret-e2e-only-secret-e2e",
      BETTER_AUTH_URL: "http://localhost:3000",
    },
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});

import { defineConfig, devices } from "@playwright/test";

// PORT lets a second checkout run e2e while another server holds 3000.
const port = process.env.PORT ?? "3000";
const base = `http://localhost:${port}`;

export default defineConfig({
  testDir: "tests/e2e",
  workers: 1, // tests share one in-memory database
  use: { baseURL: base },
  projects: [{ name: "mobile", use: { ...devices["Pixel 7"] } }],
  webServer: {
    command: "pnpm build && pnpm start",
    env: {
      USE_PGLITE: "1",
      BETTER_AUTH_SECRET: "e2e-only-secret-e2e-only-secret-e2e",
      BETTER_AUTH_URL: base,
    },
    url: base,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});

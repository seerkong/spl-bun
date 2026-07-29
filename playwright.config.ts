import { defineConfig } from "@playwright/test";

const frontendPort = Number(process.env.SPL_E2E_FRONTEND_PORT ?? 4294);
const backendPort = Number(process.env.SPL_E2E_BACKEND_PORT ?? 4296);

export default defineConfig({
  testDir: "packages/web-ide/__tests__/e2e",
  // Keep Playwright e2e tests out of Bun's default `*.spec.ts` discovery.
  testMatch: "**/*.e2e.ts",
  timeout: 30_000,
  workers: 2,
  use: {
    baseURL: `http://127.0.0.1:${frontendPort}`,
  },
  projects: [
    {
      name: "chromium",
      use: {
        browserName: "chromium",
      },
    },
  ],
  webServer: [
    {
      command: "bun run --filter depa-data-web-server dev",
      url: `http://localhost:${backendPort}/api/health`,
      // Backend must not be re-used, otherwise local/manual DB mutations can leak into e2e.
      reuseExistingServer: false,
      env: {
        PORT: String(backendPort),
        // Use an ignored, throwaway DB for e2e and rebuild it each run.
        SPL_DEMO_DB_PATH: "data/out/demo.e2e.db",
        SPL_DEMO_DB_RESET: "1",
      },
      timeout: 60_000,
    },
    {
      command: `bun run --filter depa-data-web-ide dev --host 127.0.0.1 --port ${frontendPort} --strictPort`,
      url: `http://127.0.0.1:${frontendPort}`,
      reuseExistingServer: false,
      env: { VITE_API_BASE_URL: `http://localhost:${backendPort}` },
      timeout: 60_000,
    },
  ],
});

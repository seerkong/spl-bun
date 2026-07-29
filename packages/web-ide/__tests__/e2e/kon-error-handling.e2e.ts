import { test, expect } from "@playwright/test";
import { startBackend, startFrontend, waitForDemoLoad, runScript } from "./helpers";

test.beforeAll(async () => {
  await startBackend();
  await startFrontend();
});

test("kon shows error for invalid script", async ({ page }) => {
  await page.goto("/");
  await waitForDemoLoad(page);

  await page.fill(".kon-editor", '(spl_query :{ conn = nosuch sql = "select 1" })');
  const status = await runScript(page, "error");
  expect(status).toMatch(/^Error:/);
  expect(status).toContain("nosuch");
});

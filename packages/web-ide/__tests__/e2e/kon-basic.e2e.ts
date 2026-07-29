import { test, expect } from "@playwright/test";
import {
  startBackend,
  startFrontend,
  waitForDemoLoad,
  selectDemo,
  runScript,
  getGridData,
} from "./helpers";

test.beforeAll(async () => {
  await startBackend();
  await startFrontend();
});

// behavior web-ide-kon / kon-ide-page

test("kon ide: loads demo list and runs a demo script (run-script case)", async ({ page }) => {
  await page.goto("/");
  await waitForDemoLoad(page);

  // Kon editor is the primary editing surface on /.
  await expect(page.locator(".kon-editor")).toBeVisible();

  const options = await page.locator("#demoSelect option").allTextContents();
  expect(options.length).toBeGreaterThanOrEqual(5);

  await selectDemo(page, "US States");
  const status = await runScript(page, "done");
  expect(status).toContain("Done");

  const { rows } = await getGridData(page);
  expect(rows.length).toBeGreaterThan(0);
});

test("kon ide: unknown datasource shows Error: status (error-status case)", async ({ page }) => {
  await page.goto("/");
  await waitForDemoLoad(page);

  await page.fill(".kon-editor", '(spl_query :{ conn = nosuch sql = "select 1" })');
  const status = await runScript(page, "error");
  expect(status).toMatch(/^Error:/);
  // Error message should carry locatable information (the unknown source name).
  expect(status).toContain("nosuch");
});

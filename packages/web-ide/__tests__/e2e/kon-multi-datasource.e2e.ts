import { test, expect } from "@playwright/test";
import { startBackend, startFrontend, waitForDemoLoad, selectDemo, runScript, getGridData } from "./helpers";

test.beforeAll(async () => {
  await startBackend();
  await startFrontend();
});

test("kon runs multi-source query demo", async ({ page }) => {
  await page.goto("/");
  await waitForDemoLoad(page);

  await selectDemo(page, "Multi-Source Query");
  await runScript(page);
  const grid = await getGridData(page);
  expect(grid.rows.length).toBeGreaterThan(0);
});

test("kon runs cross-datasource join demo", async ({ page }) => {
  await page.goto("/");
  await waitForDemoLoad(page);

  await selectDemo(page, "Cross-Datasource Join");
  await runScript(page);
  const grid = await getGridData(page);
  expect(grid.columns).toContain("price");
});

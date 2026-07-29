import { test, expect } from "@playwright/test";
import { konDemos } from "../../src/pages/konDemos";
import { startBackend, startFrontend, waitForDemoLoad } from "./helpers";

test.beforeAll(async () => {
  await startBackend();
  await startFrontend();
});

test("kon demo list retains legacy demos and adds the native window surface", async ({ page }) => {
  await page.goto("/");
  await waitForDemoLoad(page);

  expect(konDemos).toHaveLength(34);
  expect(konDemos.some((demo) => demo.id === "window-functions")).toBe(true);
  expect(new Set(konDemos.map((demo) => demo.id)).size).toBe(konDemos.length);

  const optionValues = await page
    .locator("#demoSelect option")
    .evaluateAll((options) => options.map((option) => (option as HTMLOptionElement).value));

  expect(optionValues).toEqual(konDemos.map((demo) => demo.id));
});

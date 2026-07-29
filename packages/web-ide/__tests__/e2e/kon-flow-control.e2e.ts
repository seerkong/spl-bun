import { test, expect } from "@playwright/test";
import { startBackend, startFrontend, waitForDemoLoad, selectDemo, runScript, getGridData } from "./helpers";

test.beforeAll(async () => {
  await startBackend();
  await startFrontend();
});

test("kon runs flow-control demos", async ({ page }) => {
  await page.goto("/");
  await waitForDemoLoad(page);

  const demos: {
    label: string;
    expectStatus?: "done" | "error";
    expectNames?: string[];
    expectValueFor?: Record<string, string>;
    expectStatusContains?: string;
  }[] = [
    { label: "Flow Control: If/ElseIf/Else", expectNames: ["branch"], expectValueFor: { branch: "eq0" } },
    { label: "Flow Control: For (count)", expectNames: ["sum"], expectValueFor: { sum: "6" } },
    { label: "Flow Control: For (range)", expectNames: ["sum"], expectValueFor: { sum: "9" } },
    { label: "Flow Control: For (sequence)", expectNames: ["sum"], expectValueFor: { sum: "6" } },
    { label: "Flow Control: For (while + #seq)", expectNames: ["total", "i"], expectValueFor: { total: "6", i: "3" } },
    { label: "Flow Control: For (infinite + break)", expectNames: ["count"], expectValueFor: { count: "3" } },
    { label: "Flow Control: Continue", expectNames: ["sum"], expectValueFor: { sum: "12" } },
    { label: "Flow Control: Break (target)", expectNames: ["hit"], expectValueFor: { hit: "4" } },
    { label: "Flow Control: Continue (target)", expectNames: ["hit"], expectValueFor: { hit: "8" } },
    { label: "Flow Control: Goto", expectNames: ["x"], expectValueFor: { x: "2" } },
    { label: "Flow Control: Func/Return", expectNames: ["v"], expectValueFor: { v: "3" } },
    { label: "Flow Control: Try", expectNames: ["try", "ok"], expectValueFor: { ok: "2" } },
    { label: "Flow Control: Result", expectNames: ["phase"], expectValueFor: { phase: "before-result" } },
    { label: "Flow Control: End", expectStatus: "error", expectStatusContains: "boom" },
    {
      label: "Flow Control: Execute-only (>)",
      expectNames: ["x", "A2_unset"],
      expectValueFor: { x: "10", A2_unset: "true" },
    },
  ];

  for (const demo of demos) {
    await selectDemo(page, demo.label);
    const statusText = await runScript(page, demo.expectStatus ?? "done");

    if (demo.expectStatus === "error") {
      if (demo.expectStatusContains) {
        expect(statusText).toContain(demo.expectStatusContains);
      }
      continue;
    }

    const grid = await getGridData(page);
    expect(grid.columns).toEqual(["name", "value"]);
    const rowByName = new Map(grid.rows.map((row) => [row[0], row[1] ?? ""]));

    for (const name of demo.expectNames ?? []) {
      expect(rowByName.has(name)).toBe(true);
    }

    if (demo.expectValueFor) {
      for (const [name, value] of Object.entries(demo.expectValueFor)) {
        expect(rowByName.get(name)).toBe(value);
      }
    }
  }
});

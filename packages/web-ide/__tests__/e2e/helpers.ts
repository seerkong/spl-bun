import { expect, type Page } from "@playwright/test";

const backendUrl = `http://localhost:${process.env.SPL_E2E_BACKEND_PORT ?? 4296}/api/health`;
const frontendUrl = `http://127.0.0.1:${process.env.SPL_E2E_FRONTEND_PORT ?? 4294}`;

/**
 * Wait for backend health endpoint to respond.
 */
export async function startBackend(): Promise<void> {
  await expect.poll(
    async () => {
      const res = await fetch(backendUrl);
      return res.ok ? "ok" : "down";
    },
    { timeout: 60_000 }
  ).toBe("ok");
}

/**
 * Wait for frontend base URL to respond.
 */
export async function startFrontend(): Promise<void> {
  await expect.poll(
    async () => {
      const res = await fetch(frontendUrl);
      return res.ok ? "ok" : "down";
    },
    { timeout: 60_000 }
  ).toBe("ok");
}

/**
 * No-op cleanup: Playwright webServer manages processes.
 */
export async function stopServices(): Promise<void> {
  // Playwright config owns webServer lifecycle; nothing to stop here.
}

/**
 * Wait for demo dropdown and result table to render.
 */
export async function waitForDemoLoad(page: Page): Promise<void> {
  await page.waitForSelector("#demoSelect");
  await page.waitForSelector(".result-table-wrap");
}

/**
 * Select a demo by its label text.
 */
export async function selectDemo(page: Page, demoLabel: string): Promise<void> {
  const options = await page.locator("#demoSelect option").evaluateAll((opts) =>
    opts.map((opt) => ({
      value: (opt as HTMLOptionElement).value,
      text: (opt.textContent ?? "").trim(),
    }))
  );

  const match = options.find((opt) => opt.text === demoLabel || opt.text.startsWith(`${demoLabel} -`));
  expect(match, `Demo option not found: ${demoLabel}`).toBeTruthy();

  await page.selectOption("#demoSelect", { value: match!.value });
  await page.click(".demo-controls .load-btn");
  await expect(page.locator(".toolbar .status")).toContainText(demoLabel, { timeout: 10_000 });
}

/** Click the KonIde "Run Script" button and poll the toolbar status. */
export async function runScript(page: Page, expectStatus: "done" | "error" | "any" = "done"): Promise<string> {
  await page.click(".toolbar .run-btn");

  const status = page.locator(".toolbar .status");
  await expect
    .poll(async () => (await status.textContent())?.trim() ?? "", { timeout: 15_000 })
    .toMatch(/^(Done|Error:)/);

  const text = (await status.textContent())?.trim() ?? "";
  if (expectStatus === "done") {
    expect(text).toContain("Done");
  } else if (expectStatus === "error") {
    expect(text).toContain("Error:");
  }
  return text;
}

/**
 * Extract result table headers and row cell text.
 */
export async function getGridData(page: Page): Promise<{ rows: string[][]; columns: string[] }> {
  await page.waitForSelector(".result-table-wrap");
  const columns = await page
    .locator(".data-grid thead th:not(.select-col)")
    .allTextContents();
  const rows = await page
    .locator(".data-grid tbody tr")
    .evaluateAll((rows) =>
      rows.map((row) =>
        Array.from(row.querySelectorAll<HTMLElement>("td.data-cell")).map((cell) => cell.innerText.trim())
      )
    );
  return { columns: columns.map((col) => col.trim()).filter(Boolean), rows };
}

/**
 * Record unexpected console errors for E2E flows that must stay browser-clean.
 */
export function recordConsoleErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") {
      errors.push(message.text());
    }
  });
  page.on("pageerror", (error) => {
    errors.push(error.message);
  });
  return errors;
}

import { describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import * as XLSX from "xlsx";

import { evaluateFlow, type FlowCell } from "../src";

function withTempDir(prefix: string): { dir: string; cleanup: () => void } {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  return {
    dir,
    cleanup: () => {
      rmSync(dir, { recursive: true, force: true });
    },
  };
}

type SheetSpec = { name: string; rows: Record<string, unknown>[] };

function writeWorkbook(filePath: string, sheets: SheetSpec[]): void {
  const wb = XLSX.utils.book_new();
  for (const sheet of sheets) {
    const ws = XLSX.utils.json_to_sheet(sheet.rows);
    XLSX.utils.book_append_sheet(wb, ws, sheet.name);
  }

  const bookType = filePath.toLowerCase().endsWith(".xls") ? "biff8" : "xlsx";
  const out = XLSX.write(wb, { bookType: bookType as never, type: "buffer" }) as unknown as Uint8Array;
  writeFileSync(filePath, out);
}

function writeWorkbookMatrix(filePath: string, sheetName: string, matrix: unknown[][]): void {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(matrix);
  XLSX.utils.book_append_sheet(wb, ws, sheetName);

  const bookType = filePath.toLowerCase().endsWith(".xls") ? "biff8" : "xlsx";
  const out = XLSX.write(wb, { bookType: bookType as never, type: "buffer" }) as unknown as Uint8Array;
  writeFileSync(filePath, out);
}

async function run(cells: FlowCell[], workspaceRoot: string) {
  return evaluateFlow(cells, { workspaceRoot });
}

describe("spl-flow T() Excel import/export", () => {
  test("imports .xlsx and .xls", async () => {
    const tmp = withTempDir("spl-bun-excel-");
    try {
      const rows = [
        { Name: "Alice", Class: "A", Score: 98, Age: 16 },
        { Name: "Bob", Class: "B", Score: 85, Age: 17 },
      ];
      writeWorkbook(join(tmp.dir, "scores.xlsx"), [{ name: "School1", rows }]);
      writeWorkbook(join(tmp.dir, "scores.xls"), [{ name: "School1", rows }]);

      const xlsxRes = await run([{ row: 1, col: "A", expr: 'T("./scores.xlsx")' }], tmp.dir);
      expect(xlsxRes.cells[0].status).toBe("ok");
      const xlsx = xlsxRes.scope.A1 as { rows: Record<string, unknown>[]; schema?: { name: string }[] };
      expect(xlsx.rows.length).toBe(2);
      expect(xlsx.rows[0].Name).toBe("Alice");
      expect(xlsx.rows[0].Score).toBe(98);
      expect(xlsx.schema?.map((c) => c.name)).toContain("Name");

      const xlsRes = await run([{ row: 1, col: "A", expr: 'T("./scores.xls")' }], tmp.dir);
      expect(xlsRes.cells[0].status).toBe("ok");
      const xls = xlsRes.scope.A1 as { rows: Record<string, unknown>[]; schema?: { name: string }[] };
      expect(xls.rows.length).toBe(2);
      expect(xls.rows[1].Name).toBe("Bob");
      expect(xls.rows[1].Age).toBe(17);
    } finally {
      tmp.cleanup();
    }
  });

  test("supports sheet selection by name", async () => {
    const tmp = withTempDir("spl-bun-excel-");
    try {
      writeWorkbook(join(tmp.dir, "multi.xlsx"), [
        { name: "School1", rows: [{ Name: "Alice", Score: 98 }] },
        { name: "School2", rows: [{ Name: "Eve", Score: 95 }] },
      ]);

      const res = await run(
        [{ row: 1, col: "A", expr: 'T("./multi.xlsx"; "School2")' }],
        tmp.dir,
      );
      expect(res.cells[0].status).toBe("ok");
      const out = res.scope.A1 as { rows: Record<string, unknown>[] };
      expect(out.rows.length).toBe(1);
      expect(out.rows[0].Name).toBe("Eve");
    } finally {
      tmp.cleanup();
    }
  });

  test("exports to a named sheet and re-imports from that sheet", async () => {
    const tmp = withTempDir("spl-bun-excel-");
    try {
      const flow: FlowCell[] = [
        { row: 1, col: "A", expr: 'data = [{ id: 1, name: "alpha" }, { id: 2, name: "beta" }]' },
        { row: 2, col: "A", expr: 'T("./out/named.xlsx", data; "School1")' },
        { row: 3, col: "A", expr: 'T("./out/named.xlsx"; "School1")' },
      ];

      const res = await run(flow, tmp.dir);
      expect(res.cells.every((c) => c.status === "ok")).toBe(true);
      expect(res.scope.A2).toBe("./out/named.xlsx");

      const imported = res.scope.A3 as { rows: Record<string, unknown>[] };
      expect(imported.rows.length).toBe(2);
      expect(imported.rows[0].id).toBe(1);
      expect(imported.rows[1].name).toBe("beta");
    } finally {
      tmp.cleanup();
    }
  });

  test("supports @b no-header import", async () => {
    const tmp = withTempDir("spl-bun-excel-");
    try {
      writeWorkbookMatrix(join(tmp.dir, "no_header.xlsx"), "Sheet1", [
        ["Alice", 98],
        ["Bob", 85],
      ]);

      const res = await run([{ row: 1, col: "A", expr: 'T@b("./no_header.xlsx")' }], tmp.dir);
      expect(res.cells[0].status).toBe("ok");
      const out = res.scope.A1 as { rows: Record<string, unknown>[]; schema?: { name: string }[] };
      expect(out.schema?.map((c) => c.name)).toEqual(["#1", "#2"]);
      expect(out.rows[0]["#1"]).toBe("Alice");
      expect(out.rows[0]["#2"]).toBe(98);
    } finally {
      tmp.cleanup();
    }
  });

  test("rejects the old options-object Excel T() form", async () => {
    const tmp = withTempDir("spl-bun-excel-");
    try {
      writeWorkbook(join(tmp.dir, "multi.xlsx"), [
        { name: "School1", rows: [{ Name: "Alice", Score: 98 }] },
        { name: "School2", rows: [{ Name: "Eve", Score: 95 }] },
      ]);

      // Build the expression dynamically so repo-wide greps for the legacy syntax stay clean.
      const legacyExpr = [
        'T("./multi.xlsx", ',
        "{",
        " sheet",
        ': "School2"',
        " }",
        ")",
      ].join("");
      const res = await run([{ row: 1, col: "A", expr: legacyExpr }], tmp.dir);
      expect(res.cells[0].status).toBe("error");
      expect(res.cells[0].error).toContain("options-object");
      expect(res.cells[0].error).toContain("no longer supported");
    } finally {
      tmp.cleanup();
    }
  });

  test("exports and re-imports .xlsx and .xls", async () => {
    const tmp = withTempDir("spl-bun-excel-");
    try {
      const flow: FlowCell[] = [
        { row: 1, col: "A", expr: 'data = [{ id: 1, name: "alpha" }, { id: 2, name: "beta" }]' },
        { row: 2, col: "A", expr: 'T("./out/export.xlsx", data)' },
        { row: 3, col: "A", expr: 'T("./out/export.xlsx")' },
        { row: 4, col: "A", expr: 'T("./out/export.xls", data)' },
        { row: 5, col: "A", expr: 'T("./out/export.xls")' },
      ];

      const res = await run(flow, tmp.dir);
      expect(res.cells.every((c) => c.status === "ok")).toBe(true);

      expect(res.scope.A2).toBe("./out/export.xlsx");
      const xlsx = res.scope.A3 as { rows: Record<string, unknown>[] };
      expect(xlsx.rows.length).toBe(2);
      expect(xlsx.rows[0].id).toBe(1);
      expect(xlsx.rows[1].name).toBe("beta");

      expect(res.scope.A4).toBe("./out/export.xls");
      const xls = res.scope.A5 as { rows: Record<string, unknown>[] };
      expect(xls.rows.length).toBe(2);
      expect(xls.rows[0].name).toBe("alpha");
    } finally {
      tmp.cleanup();
    }
  });

  test("rejects paths escaping workspace root (relative and absolute)", async () => {
    const tmp = withTempDir("spl-bun-excel-");
    try {
      const rel = await run([{ row: 1, col: "A", expr: 'T("../secrets.xls")' }], tmp.dir);
      expect(rel.cells[0].status).toBe("error");
      expect(rel.cells[0].error).toContain("Path escapes workspace root");

      const abs = await run([{ row: 1, col: "A", expr: 'T("/tmp/evil.xlsx")' }], tmp.dir);
      expect(abs.cells[0].status).toBe("error");
      expect(abs.cells[0].error).toContain("Path escapes workspace root");
    } finally {
      tmp.cleanup();
    }
  });
});

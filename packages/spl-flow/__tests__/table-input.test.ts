import { describe, expect, test } from "bun:test";
import * as XLSX from "xlsx";
import { importTable, parseCsvTable, tableFromRecords, evaluateFlowSync } from "../src";

describe("table input", () => {
  test("CSV quotes, escaped quotes, multiline fields, BOM and identifier strings", () => {
    const raw = '\ufeffid,name,note,amount\r\n001,"A,B","line1\nline2 ""quoted""",12.50';
    expect(parseCsvTable(raw)).toEqual({ columns: ["id", "name", "note", "amount"], rows: [{ id: "001", name: "A,B", note: 'line1\nline2 "quoted"', amount: 12.5 }] });
    const flow = evaluateFlowSync([{ row: 1, col: "A", expr: "csv(raw)" }], { scope: { raw } });
    expect((flow.scope.A1 as { rows: Record<string, unknown>[] }).rows[0].note).toBe('line1\nline2 "quoted"');
    expect(() => parseCsvTable('a,b\n"unclosed,2')).toThrow();
    expect(() => parseCsvTable("a,a\n1,2")).toThrow("Duplicate");
  });
  test("JSON unions later columns instead of dropping their values", () => {
    expect(tableFromRecords([{ a: 1 }, { b: 2 }])).toEqual({ columns: ["a", "b"], rows: [{ a: 1, b: null }, { a: null, b: 2 }] });
  });
  test("XLSX sheet selection, typed numbers and empty header-only data", () => {
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([["id", "qty"], ["001", 2]]), "First");
    XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([["name"]]), "Empty");
    const bytes = new Uint8Array(XLSX.write(book, { type: "buffer", bookType: "xlsx" }));
    expect(importTable(bytes, "data.xlsx").rows).toEqual([{ id: "001", qty: 2 }]);
    expect(importTable(bytes, "data.xlsx", { sheet: "Empty" })).toMatchObject({ columns: ["name"], rows: [], selectedSheet: "Empty", sheetNames: ["First", "Empty"] });
    expect(() => importTable(bytes, "data.xlsx", { sheet: "Missing" })).toThrow("Unknown Excel sheet");
    expect(() => importTable(bytes, "data.xlsx", { maxRows: 0 })).toThrow("limits");
  });
});

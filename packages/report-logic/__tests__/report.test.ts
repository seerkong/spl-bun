import { describe, expect, test } from "bun:test";
import { compileReport, renderReport } from "../src";
import type { ReportExpressionRuntime, ReportTemplate } from "depa-data-report-contract";

const runtime: ReportExpressionRuntime = { evaluate(expression, scope) {
  if (expression === "null") return null;
  if (!(expression in scope)) throw new Error(`Unknown variable: ${expression}`);
  return scope[expression];
} };
const template: ReportTemplate = { sheets: [{ name: "Orders", rowCount: 3, colCount: 4,
  cells: [
    { row: 0, col: 0, value: "${title}" },
    { row: 1, col: 0, value: "*=name", annotation: "expandType=r\nexpandExpr=orders" },
    { row: 1, col: 1, value: "*=qty" },
    { row: 1, col: 2, value: "*=label" },
    { row: 2, col: 0, value: "END" },
  ], merges: [{ start: { row: 0, col: 0 }, end: { row: 0, col: 3 } }, { start: { row: 1, col: 2 }, end: { row: 1, col: 3 } }], rowHeights: { 1: 30 } }] };
const orders = [{ name: "Alice", qty: 2, label: "<b>A</b>" }, { name: "Bob", qty: 3, label: "B" }];

describe("Excel report row semantics", () => {
  test("renders parameter, rows, static footer, copies merges/heights without changing inputs", () => {
    const before = JSON.stringify(template);
    const plan = compileReport(template);
    const result = renderReport(runtime, { template: plan, datasets: { orders }, params: { title: "Orders" } });
    const sheet = result.sheets[0];
    expect(sheet.rowOrigins).toEqual([0, 1, 1, 2]);
    expect(sheet.cells.map((c) => c.value)).toEqual(["Orders", "Alice", 2, "<b>A</b>", "Bob", 3, "B", "END"]);
    expect(sheet.merges.map((m) => [m.start.row, m.end.row, m.start.col, m.end.col])).toEqual([[0, 0, 0, 3], [1, 1, 2, 3], [2, 2, 2, 3]]);
    expect(sheet.rowHeights).toEqual({ 1: 30, 2: 30 });
    expect(renderReport(runtime, { template: plan, datasets: { orders }, params: { title: "Orders" } })).toEqual(result);
    expect(JSON.stringify(template)).toBe(before);
    expect(orders[0].name).toBe("Alice");
  });
  test("empty data clears dynamic cells; keepExpandEmpty=false removes only its band", () => {
    const result = renderReport(runtime, { template: compileReport(template), datasets: { orders: [] }, params: { title: "Empty" } });
    expect(result.sheets[0].cells.map((c) => c.value)).toEqual(["Empty", undefined, undefined, undefined, "END"]);
    const remove = structuredClone(template);
    (remove.sheets[0].cells[1] as { annotation: string }).annotation += "\nkeepExpandEmpty=false";
    expect(renderReport(runtime, { template: compileReport(remove), datasets: { orders: [] }, params: { title: "Empty" } }).sheets[0].rowOrigins).toEqual([0, 2]);
  });
  test("copies native formulas independently of report expressions", () => {
    const source = structuredClone(template);
    source.sheets[0].merges = source.sheets[0].merges.filter(merge => merge.start.row === 0);
    (source.sheets[0].cells as unknown[]).push({ row: 1, col: 3, formula: "B2*$B$1", styleId: 1 }, { row: 2, col: 3, formula: "SUM(B2:B2)" });
    const result = renderReport(runtime, { template: compileReport(source), datasets: { orders }, params: { title: "Prices" } });
    expect(result.sheets[0].cells.filter((c) => c.formula).map((c) => c.formula)).toEqual(["B2*$B$1", "B3*$B$1", "SUM(B2:B3)"]);
  });
  test("bounds expansion and gives source location for invalid expression/annotation", () => {
    expect(() => renderReport(runtime, { template: compileReport(template), datasets: { orders }, params: { title: "Orders" } }, { maxRows: 2 })).toThrow("row limit");
    const bad = structuredClone(template);
    (bad.sheets[0].cells[1] as { annotation: string }).annotation = "expandType=r\nexpandExpr=orders\nunknownSetting=unsupported";
    expect(() => compileReport(bad)).toThrow("Orders!A2: unsupported report annotation");
    expect(() => renderReport(runtime, { template: compileReport(template), datasets: { orders: [{}] }, params: { title: "Bad" } })).toThrow("Orders!A2");
  });
  test("evaluator cannot change caller records and a bad static formula stays separate", () => {
    const records = [{ name: "Alice", qty: 2, label: "a" }];
    const mutating: ReportExpressionRuntime = { evaluate(expression, scope) {
      if (expression === "name") (scope.item as { name: string }).name = "corrupted";
      return scope[expression];
    } };
    expect(() => renderReport(mutating, { template: compileReport(template), datasets: { orders: records }, params: { title: "t" } })).toThrow();
    expect(records[0].name).toBe("Alice");
  });
});

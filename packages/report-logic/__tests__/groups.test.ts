import { describe, expect, test } from "bun:test";
import { compileExpression } from "depa-data-expression";
import type { ReportTemplate, ReportExpressionRuntime, TemplateCell } from "depa-data-report-contract";
import { compileReport, renderReport, cellAddress } from "../src";

const runtime: ReportExpressionRuntime = { evaluate: (source, scope) => compileExpression(source).evaluate(scope) };
const make = (cells: TemplateCell[], rowCount: number, colCount: number): ReportTemplate => ({ sheets: [{ name: "Report", cells, rowCount, colCount, merges: [] }] });
const values = (report: ReturnType<typeof renderReport>) => Object.fromEntries(report.sheets[0].cells.map((cell) => [cellAddress(cell), cell.value]));

describe("parent groups and two-axis templates", () => {
  test("nested encounter-order groups retain duplicate records and stretch region labels", () => {
    const template = make([
      { row: 0, col: 0, value: "Region" },
      { row: 1, col: 0, value: "*=^sales!region" },
      { row: 1, col: 1, value: "*=^sales!person" },
      { row: 1, col: 2, annotation: 'valueExpr=records.sum("qty")' },
      { row: 2, col: 2, annotation: 'valueExpr=sales.sum("qty")\nrowParent=A0' },
    ], 3, 3);
    const result = renderReport(runtime, { template: compileReport(template), datasets: { sales: [
      { region: "East", person: "A", qty: 2 }, { region: "East", person: "A", qty: 3 },
      { region: "East", person: "B", qty: 4 }, { region: "West", person: "C", qty: 5 },
    ] } });
    expect(values(result)).toMatchObject({ A2: "East", B2: "A", C2: 5, B3: "B", C3: 4, A4: "West", B4: "C", C4: 5, C5: 14 });
    expect(result.sheets[0].merges).toContainEqual({ start: { row: 1, col: 0 }, end: { row: 2, col: 0 } });
  });
  test("cross table intersects record IDs, keeps duplicate matches, and never falls back on empty", () => {
    const template = make([
      { row: 0, col: 0, value: "Region" },
      { row: 0, col: 1, value: "*=>sales!product" },
      { row: 1, col: 0, value: "*=^sales!region" },
      { row: 1, col: 1, annotation: 'valueExpr=if(records.count()==0,0,records.sum("qty"))' },
    ], 2, 2);
    const result = renderReport(runtime, { template: compileReport(template), datasets: { sales: [
      { region: "East", product: "Apple", qty: 2 }, { region: "East", product: "Milk", qty: 3 },
      { region: "East", product: "Apple", qty: 4 }, { region: "West", product: "Milk", qty: 5 },
    ] } });
    expect(values(result)).toEqual({ A1: "Region", B1: "Apple", C1: "Milk", A2: "East", B2: 6, C2: 3, A3: "West", B3: 0, C3: 5 });
    expect(result.sheets[0].merges).toEqual([]);
  });
  test("different dataset names do not collide and A0 breaks inherited context", () => {
    const template = make([
      { row: 0, col: 1, value: "*=>catalog!product" },
      { row: 1, col: 0, value: "*=^sales!region" },
      { row: 1, col: 1, annotation: 'valueExpr=sales.sum("qty")' },
      { row: 2, col: 1, annotation: 'valueExpr=sales.sum("qty")\nrowParent=A0\ncolParent=A0' },
    ], 3, 2);
    const result = renderReport(runtime, { template: compileReport(template), datasets: {
      catalog: [{ product: "Apple" }, { product: "Milk" }], sales: [{ region: "E", qty: 7 }, { region: "W", qty: 9 }],
    } });
    expect(values(result)).toMatchObject({ B2: 7, C2: 7, B3: 9, C3: 9, B4: 16 });
    expect(result.sheets[0].merges).toContainEqual({ start: { row: 3, col: 1 }, end: { row: 3, col: 2 } });
  });
  test("explicit right-side parent and multirow record paragraphs", () => {
    const template = make([
      { row: 0, col: 0, value: "*=name", annotation: "rowParent=B1" },
      { row: 0, col: 1, annotation: "expandType=r\nexpandExpr=orders\nvalueExpr=null" },
      { row: 1, col: 0, value: "qty=${qty}" },
      { row: 2, col: 0, value: "---", annotation: "rowParent=B1" },
      { row: 3, col: 0, value: "END" },
    ], 4, 2);
    const result = renderReport(runtime, { template: compileReport(template), datasets: { orders: [{ name: "A", qty: 2 }, { name: "B", qty: 3 }] } });
    expect(values(result)).toMatchObject({ A1: "A", A2: "qty=2", A3: "---", A4: "B", A5: "qty=3", A6: "---", A7: "END" });
  });
  test("rejects missing, single-axis and joint cycles with location", () => {
    expect(() => compileReport(make([{ row: 0, col: 0, annotation: "rowParent=B1" }], 1, 1))).toThrow("Report!A1: missing");
    expect(() => compileReport(make([{ row: 0, col: 0, annotation: "rowParent=B1" }, { row: 0, col: 1, annotation: "rowParent=A1" }], 1, 2))).toThrow("cyclic");
    expect(() => compileReport(make([{ row: 0, col: 0, annotation: "rowParent=B1" }, { row: 0, col: 1, annotation: "colParent=A1" }], 1, 2))).toThrow("cyclic");
  });
  test("typed group values remain distinct and min/max bounds are explicit", () => {
    const template = make([{ row: 0, col: 0, value: "*=^data!key" }], 1, 1);
    const result = renderReport(runtime, { template: compileReport(template), datasets: { data: [{ key: 1 }, { key: "1" }, { key: null }, {}] } });
    expect(result.sheets[0].cells.map((c) => c.value)).toEqual([1, "1", null, undefined]);
    const limit = make([{ row: 0, col: 0, value: "*=name", annotation: "expandType=r\nexpandExpr=data\nexpandMinCount=3\nexpandMaxCount=3" }], 1, 1);
    expect(renderReport(runtime, { template: compileReport(limit), datasets: { data: [{ name: "A" }] } }).sheets[0].cells.map((c) => c.value)).toEqual(["A", undefined, undefined]);
  });
  test("sheet-local group caches cannot reuse another sheet's record membership", () => {
    const byRegion = make([{ row: 0, col: 0, value: "*=^sales!region" }, { row: 0, col: 1, annotation: 'valueExpr=records.sum("qty")' }], 1, 2).sheets[0];
    const byProduct = make([{ row: 0, col: 0, value: "*=^sales!product" }, { row: 0, col: 1, annotation: 'valueExpr=records.sum("qty")' }], 1, 2).sheets[0];
    const report = renderReport(runtime, { template: compileReport({ sheets: [{ ...byRegion, name: "Regions" }, { ...byProduct, name: "Products" }] }), datasets: { sales: [
      { region: "E", product: "A", qty: 2 }, { region: "E", product: "B", qty: 3 }, { region: "W", product: "A", qty: 4 },
    ] } });
    expect(report.sheets[1].cells.filter((c) => c.col === 1).map((c) => c.value)).toEqual([6, 3]);
  });
  test("nested column groups stretch headers, while footer formulas stay in their product column", () => {
    const template = make([
      { row: 0, col: 1, value: "*=>sales!kind" },
      { row: 1, col: 1, value: "*=>sales!product" },
      { row: 2, col: 0, value: "*=^sales!region" },
      { row: 2, col: 1, annotation: 'valueExpr=if(records.count()==0,0,records.sum("qty"))' },
      { row: 3, col: 1, formula: "SUM(B3:B3)" },
    ], 4, 2);
    const result = renderReport(runtime, { template: compileReport(template), datasets: { sales: [
      { kind: "Food", product: "A", region: "E", qty: 2 }, { kind: "Food", product: "B", region: "E", qty: 3 },
      { kind: "Drink", product: "C", region: "W", qty: 4 },
    ] } });
    expect(values(result)).toMatchObject({ B1: "Food", D1: "Drink", B2: "A", C2: "B", D2: "C", B3: 2, C3: 3, D4: 4 });
    expect(result.sheets[0].merges).toContainEqual({ start: { row: 0, col: 1 }, end: { row: 0, col: 2 } });
    expect(result.sheets[0].cells.filter((c) => c.formula).map((c) => c.formula)).toEqual(["SUM(B3:B4)", "SUM(C3:C4)", "SUM(D3:D4)"]);
  });
});

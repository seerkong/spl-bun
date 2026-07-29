import { expect, test } from "bun:test";
import { compileExpression } from "depa-data-expression";
import { compileReport, renderReport } from "../src";
import type { ReportTemplate, ReportExpressionRuntime, TemplateCell } from "depa-data-report-contract";

const runtime: ReportExpressionRuntime = { evaluate: (expression, scope) => compileExpression(expression).evaluate(scope) };
const sales = [{ region: "North", id: 1, qty: 10 }, { region: "North", id: 2, qty: 20 }, { region: "South", id: 3, qty: 7 }, { region: "South", id: 4, qty: 8 }];
const formula = (row: number, col: number, source: string, parent = "A0"): TemplateCell => ({ row, col, annotation: `valueExpr=${source}\nrowParent=${parent}\ncolParent=A0` });
function groups(): ReportTemplate {
  return { sheets: [{ name: "Groups", rowCount: 3, colCount: 8, merges: [], cells: [
    { row: 1, col: 0, value: "*=^sales!region" },
    { row: 1, col: 1, value: "*=id", annotation: "expandType=r\nexpandExpr=sales" },
    { row: 1, col: 2, value: "*=qty" },
    formula(1, 3, "SUM(C2)", "A2"), formula(1, 4, "SUM(C2[A2:2])", "A2"),
    formula(1, 5, "SUM(C2[A2:-1])", "A2"), formula(1, 6, "SUM(C2[A2:!-1])", "A2"),
    formula(1, 7, "IF(B2.expandIndex>0,C2/C2[B2:-1],'--')", "B2"),
    formula(2, 2, "SUM(C2)"), formula(2, 3, 'SUM(IF("e.value <= 10",C2))'),
  ] }] };
}
const valuesFor = (template: ReportTemplate, origin: string) => renderReport(runtime, { template: compileReport(template), datasets: { sales } }).sheets[0].cells.filter(c => c.origin === origin).map(c => c.value);

test("report formula selects template instances in group, absolute, relative and reverse contexts", () => {
  expect(valuesFor(groups(), "D2")).toEqual([30, 15]);
  expect(valuesFor(groups(), "E2")).toEqual([15, 15]);
  expect(valuesFor(groups(), "F2")).toEqual([0, 30]);
  expect(valuesFor(groups(), "G2")).toEqual([15, 15]);
  expect(valuesFor(groups(), "C3")).toEqual([45]);
  expect(valuesFor(groups(), "D3")).toEqual([25]);
  expect(valuesFor(groups(), "H2")).toEqual(["--", 2, "--", 8 / 7]);
  expect(sales[0].qty).toBe(10);
});

test("two-dimensional layer paths intersect identities, including relative +0 and empty paths", () => {
  const template: ReportTemplate = { sheets: [{ name: "Matrix", rowCount: 3, colCount: 3, merges: [], cells: [
    { row: 0, col: 1, value: "*=>sales!month" }, { row: 1, col: 0, value: "*=^sales!region" },
    { row: 1, col: 1, annotation: 'valueExpr=records.sum("qty")' },
    formula(2, 0, "SUM(B2[A2:1;B1:2])"), formula(2, 2, "SUM(B2[A2:0])"),
  ] }] };
  const data = [{ region: "N", month: "Jan", qty: 10 }, { region: "N", month: "Feb", qty: 20 }, { region: "S", month: "Jan", qty: 30 }, { region: "S", month: "Feb", qty: 40 }];
  const output = renderReport(runtime, { template: compileReport(template), datasets: { sales: data } }).sheets[0];
  expect(output.cells.find(c => c.origin === "A3")?.value).toBe(20);
  expect(output.cells.find(c => c.origin === "C3")?.value).toBe(0);
});

test("forward dependencies calculate once and cycles/cardinality have source and output locations", () => {
  let calls = 0;
  const source: ReportTemplate = { sheets: [{ name: "Deps", rowCount: 1, colCount: 3, merges: [], cells: [formula(0, 0, "C1+1"), { row: 0, col: 1, value: "*=value" }, formula(0, 2, "B1*2")] }] };
  const counted: ReportExpressionRuntime = { evaluate(expr, scope) { if (expr === "value") { calls++; return 4; } return runtime.evaluate(expr, scope); } };
  const output = renderReport(counted, { template: compileReport(source) });
  expect(output.sheets[0].cells.map(c => c.value)).toEqual([9, 4, 8]); expect(calls).toBe(1);
  const cyclic = structuredClone(source);
  (cyclic.sheets[0].cells as TemplateCell[])[1] = formula(0, 1, "A1+1");
  expect(() => renderReport(runtime, { template: compileReport(cyclic) })).toThrow(/Cyclic formula dependency:.*Deps!A1.*Deps!C1.*Deps!B1.*Deps!A1/);
  const many = groups(); (many.sheets[0].cells as TemplateCell[]).push(formula(2, 4, "C2+1"));
  expect(() => renderReport(runtime, { template: compileReport(many), datasets: { sales } })).toThrow("requires one cell, received 4");
});

test("native Excel coordinates, forward references, lazy IF and unsupported state", () => {
  const template: ReportTemplate = { sheets: [{ name: "Orders", rowCount: 3, colCount: 4, merges: [], cells: [
    { row: 0, col: 0, value: "*=id", annotation: "expandType=r\nexpandExpr=orders" },
    { row: 0, col: 1, value: "*=qty" }, { row: 0, col: 2, value: "*=price" }, { row: 0, col: 3, formula: "B1*C1" },
    { row: 1, col: 3, formula: "SUM(D1:D1)" },
    { row: 2, col: 0, formula: 'IF(TRUE,42,UNKNOWN(1))' }, { row: 2, col: 1, formula: 'UNKNOWN(1)' },
    { row: 2, col: 2, value: "=literal" }, { row: 2, col: 3, formula: 'IF(FALSE,1)' },
  ] }] };
  const output = renderReport(runtime, { template: compileReport(template), datasets: { orders: [{ id: 1, qty: 2, price: 10 }, { id: 2, qty: 3, price: 4 }] } }).sheets[0];
  expect(output.cells.filter(c => c.origin === "D1").map(c => [c.formula, c.value, c.formulaStatus])).toEqual([["B1*C1", 20, "calculated"], ["B2*C2", 12, "calculated"]]);
  expect(output.cells.find(c => c.origin === "D2")?.value).toBe(32);
  expect(output.cells.find(c => c.origin === "A3")?.value).toBe(42);
  expect(output.cells.find(c => c.origin === "B3")?.formulaStatus).toBe("uncomputed");
  expect(output.cells.find(c => c.origin === "C3")?.value).toBe("=literal");
  expect(output.cells.find(c => c.origin === "D3")?.value).toBeNull();
});

test("Nop aggregate family preserves number-only/null/empty semantics and conditional matching", () => {
  const expressions = ['SUM(A1:D1)', 'PRODUCT(A1:D1)', 'COUNT(A1:D1)', 'COUNTA(A1:D1)', 'AVERAGE(A1:D1)', 'MIN(A1:D1)', 'MAX(A1:D1)', 'MEDIAN(A1:D1)', 'VAR(A1:D1)', 'STDEV(A1:D1)', 'SUMPRODUCT(A1:B1,A1:B1)', 'COUNTIF(A1:D1,">=2")', 'SUMIF(A1:D1,">=2")', 'CONCAT(A1:D1)', 'NVL(E1,7)'];
  const template: ReportTemplate = { sheets: [{ name: "Math", rowCount: expressions.length + 1, colCount: 5, merges: [], cells: [
    { row: 0, col: 0, value: 1 }, { row: 0, col: 1, value: 3 }, { row: 0, col: 2, value: "x" }, { row: 0, col: 3, value: false },
    ...expressions.map((expression, i) => formula(i + 1, 0, expression)),
  ] }] };
  const output = renderReport(runtime, { template: compileReport(template) }).sheets[0].cells.filter(c => c.row > 0).map(c => c.value);
  // Nop compares non-numeric values lexically for a string criterion.
  expect(output).toEqual([4, 3, 2, 4, 2, 1, 3, 2, 2, Math.sqrt(2), 10, 3, 3, "13xfalse", 7]);
});

test("rank, proportion and cumulative aggregates use instance identity and explicit parent ranges", () => {
  const template = groups();
  (template.sheets[0].cells as TemplateCell[]).splice(3);
  (template.sheets[0] as { colCount: number }).colCount = 7;
  (template.sheets[0].cells as TemplateCell[]).push(formula(1, 3, "RANK(C2)", "B2"), formula(1, 4, "PROPORTION(C2)", "B2"), formula(1, 5, "ACCSUM(C2)", "B2"), formula(1, 6, "PROPORTION(C2,A2)", "B2"));
  expect(valuesFor(template, "D2")).toEqual([2, 1, 4, 3]);
  expect(valuesFor(template, "E2")).toEqual([10/45, 20/45, 7/45, 8/45]);
  expect(valuesFor(template, "F2")).toEqual([10, 30, 37, 45]);
  expect(valuesFor(template, "G2")).toEqual([10/30, 20/30, 7/15, 8/15]);
});

test("financial source fixture keeps previous period/year, local/global rank and cumulative values", () => {
  const data = [...Array.from({ length: 12 }, (_, i) => ({ year: 2002, month: i + 1, amount: [100,200,300,400][i % 4] })), ...Array.from({ length: 5 }, (_, i) => ({ year: 2003, month: i + 1, amount: [100,200,300,400][i % 4] }))];
  const template: ReportTemplate = { sheets: [{ name: "Finance", rowCount: 1, colCount: 10, merges: [], cells: [
    { row: 0, col: 0, value: "*=^data!year" }, { row: 0, col: 1, value: "*=^data!month" }, { row: 0, col: 2, value: '*=records.sum("amount")' },
    formula(0, 3, "IF(B1.expandIndex>0,C1/C1[B1:-1],'--')", "B1"),
    formula(0, 4, "IF(A1.expandIndex>0,C1/C1[A1:-1,B1:+0],'--')", "B1"),
    formula(0, 5, "PROPORTION(C1,A1)", "B1"), formula(0, 6, "RANK(C1,A1)", "B1"), formula(0, 7, "RANK(C1)", "B1"),
    formula(0, 8, "NVL(I1[B1:-1],0)+C1", "B1"), formula(0, 9, "ACCSUM(C1)", "B1"),
  ] }] };
  const output = renderReport(runtime, { template: compileReport(template), datasets: { data } }).sheets[0];
  const value = (row: number, origin: string) => output.cells.find(c => c.row === row && c.origin === origin)?.value;
  expect([value(0,"D1"), value(0,"E1"), value(0,"F1"), value(0,"G1"), value(0,"H1"), value(0,"I1"), value(0,"J1")]).toEqual(["--","--",1/30,10,13,100,100]);
  expect([value(12,"D1"), value(12,"E1"), value(12,"F1"), value(12,"G1"), value(12,"H1"), value(12,"I1"), value(12,"J1")]).toEqual(["--",1,1/11,4,13,100,3100]);
  expect([value(16,"D1"), value(16,"E1"), value(16,"I1"), value(16,"J1")]).toEqual([0.25,1,1100,4100]);
});

test("report-mode native formulas export selected output coordinates, including global filters", () => {
  const template: ReportTemplate = { sheets: [{ name: "Export", rowCount: 2, colCount: 3, merges: [], cells: [
    { row: 0, col: 0, value: "*=item", annotation: "expandType=r\nexpandExpr=items" },
    { row: 0, col: 1, formula: "SUM(A1)+A2", formulaMode: "report" },
    { row: 0, col: 2, formula: 'SUM(IF("e.value > 1",A1))', formulaMode: "report", annotation: "rowParent=A0" },
    { row: 1, col: 0, value: 3 },
  ] }] };
  const output = renderReport(runtime, { template: compileReport(template), params: { items: [1,2,3] } }).sheets[0];
  expect(output.cells.filter(c => c.origin === "B1").map(c => [c.formula,c.value])).toEqual([["(SUM(A1)+A4)",4],["(SUM(A2)+A4)",5],["(SUM(A3)+A4)",6]]);
  expect(output.cells.find(c => c.origin === "C1")?.formula).toBe("SUM(A2:A3)");
  expect(output.cells.find(c => c.origin === "C1")?.value).toBe(5);
});

test("global IF filtering exposes read-only parent expansion values and lazy macros", () => {
  const source: ReportTemplate = { sheets: [{ name: "Filter", rowCount: 1, colCount: 4, merges: [], cells: [
    { row: 0, col: 0, value: "*=name", annotation: "expandType=r\nexpandExpr=rows" }, { row: 0, col: 1, value: "*=x" },
    formula(0, 2, `SUM(IF("e.rp.ev.name=='X2'",B1))`, "A1"),
    formula(0, 3, 'SWITCH(2,1,D1,2,IF(0,D1,7),D1)', "A1"),
  ] }] };
  const output = renderReport(runtime, { template: compileReport(source), params: { rows: [{name:"X1",x:3},{name:"X2",x:7},{name:"X3",x:9}] } }).sheets[0];
  expect(output.cells.filter(c => c.origin === "C1").map(c => c.value)).toEqual([7,7,7]);
  expect(output.cells.filter(c => c.origin === "D1").map(c => c.value)).toEqual([7,7,7]);
});

test("cellSet value indices, scalar truth, empty aggregates and macros follow report semantics", () => {
  const expressions = ["B1.value(1)+B1.value(-1)", "IF(0,9,7)", "AND()", "OR(42)", "(1>0) AND (1>2)", "SWITCH(3,1,9,2,8,7)", "COUNT(E1)", "COUNT(null)", "PRODUCT(E1)", "SUM()", "CONCAT(null)"];
  const source: ReportTemplate = { sheets: [{ name: "Edges", rowCount: expressions.length + 2, colCount: 5, merges: [], cells: [
    { row: 0, col: 1, value: "*=item", annotation: "expandType=r\nexpandExpr=items" },
    ...expressions.map((expr,i) => formula(i+2,0,expr)),
  ] }] };
  const cells = renderReport(runtime, { template: compileReport(source), params: { items: [1,2,3] } }).sheets[0].cells;
  expect(cells.filter(c => c.origin.startsWith("A")).map(c => c.value)).toEqual([5,7,false,42,false,7,0,null,1,null,""]);
});

test("normalized source Q01/Q02/Q03/Q05 fixtures retain their exact numerical oracles", () => {
  const template: ReportTemplate = { sheets: [{ name: "Source", rowCount: 3, colCount: 5, merges: [], cells: [
    { row: 0, col: 0, value: "*=a", annotation: "expandType=r\nexpandExpr=rows" },
    { row: 0, col: 1, value: "*=b" },
    formula(1, 0, "SUM(A1)"), formula(1, 1, "SUMPRODUCT(A1,B1)"),
    formula(1, 2, "SUM(A1,3)"), formula(1, 3, "SUM(A1,B1)"),
  ] }] };
  const cells = renderReport(runtime, { template: compileReport(template), params: { rows: [{ a: 1, b: 2 }, { a: 4, b: 4 }] } }).sheets[0].cells;
  expect(cells.filter(c => c.origin.endsWith("2")).map(c => c.value)).toEqual([5,18,8,11]);
  const layer: ReportTemplate = { sheets: [{ name: "Layer", rowCount: 2, colCount: 2, merges: [], cells: [
    { row: 0, col: 0, value: "*=item", annotation: "expandType=r\nexpandExpr=items" },
    formula(1, 1, "'R'+(A1.value(1)+A1.value(2))"),
  ] }] };
  expect(renderReport(runtime, { template: compileReport(layer), params: { items: [1,2,3] } }).sheets[0].cells.find(c => c.origin === "B2")?.value).toBe("R5");
  const filtered: ReportTemplate = { sheets: [{ name: "Filter", rowCount: 1, colCount: 5, merges: [], cells: [
    { row: 0, col: 0, value: "*=name", annotation: "expandType=r\nexpandExpr=rows" },
    ...["unit","a","b"].map((field, i) => ({ row: 0, col: i + 1, value: `*=${field}`, annotation: "rowParent=A1" })),
    formula(0, 4, `IF(B1="%",SUM(IF("e.rp.ev.name=='X2'",C1:D1))/SUM(IF("e.rp.ev.name=='X3'",C1:D1)),SUM(C1:D1))`, "A1"),
  ] }] };
  const rows = [{ name: "X1", unit: "", a: 1, b: 2 }, { name: "X2", unit: "", a: 3, b: 4 }, { name: "X3", unit: "", a: 4, b: 5 }, { name: "X5", unit: "%", a: null, b: null }];
  expect(renderReport(runtime, { template: compileReport(filtered), params: { rows } }).sheets[0].cells.filter(c => c.origin === "E1").map(c => c.value)).toEqual([3,7,9,7/9]);
});

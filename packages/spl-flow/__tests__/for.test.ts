import { describe, expect, test } from "bun:test";

import { evaluateFlow, type FlowCell } from "../src";

describe("spl-flow for/break/continue", () => {
  test("for n iterates 1..n", async () => {
    const cells: FlowCell[] = [
      { row: 1, col: "A", expr: "sum = 0" },
      { row: 2, col: "A", expr: "for 3" },
      { row: 3, col: "B", expr: "sum += A2" },
      { row: 4, col: "A", expr: "sum" },
    ];

    const res = await evaluateFlow(cells, {});
    expect(res.scope.A4).toBe(6);
  });

  test("for start,end,step iterates an integer range", async () => {
    const cells: FlowCell[] = [
      { row: 1, col: "A", expr: "sum = 0" },
      { row: 2, col: "A", expr: "for 1,5,2" },
      { row: 3, col: "B", expr: "sum += A2" },
      { row: 4, col: "A", expr: "sum" },
    ];

    const res = await evaluateFlow(cells, {});
    expect(res.scope.A4).toBe(9);
  });

  test("for start,end defaults step to 1", async () => {
    const cells: FlowCell[] = [
      { row: 1, col: "A", expr: "sum = 0" },
      { row: 2, col: "A", expr: "for 1,3" },
      { row: 3, col: "B", expr: "sum += A2" },
      { row: 4, col: "A", expr: "sum" },
    ];

    const res = await evaluateFlow(cells, {});
    expect(res.scope.A4).toBe(6);
  });

  test("for sequenceExpr iterates the current element", async () => {
    const cells: FlowCell[] = [
      { row: 1, col: "A", expr: "sum = 0" },
      { row: 2, col: "A", expr: "for [1,2,3]" },
      { row: 3, col: "B", expr: "sum += A2" },
      { row: 4, col: "A", expr: "sum" },
    ];

    const res = await evaluateFlow(cells, {});
    expect(res.scope.A4).toBe(6);
  });

  test("for conditionExpr is a while-loop and #<cellRef> exposes iteration number", async () => {
    const cells: FlowCell[] = [
      { row: 1, col: "A", expr: "total = 0" },
      { row: 2, col: "A", expr: "i = 0" },
      { row: 3, col: "A", expr: "for i < 3" },
      { row: 4, col: "B", expr: "i += 1" },
      { row: 5, col: "B", expr: "total += #A3" },
      { row: 6, col: "A", expr: "total" },
    ];

    const res = await evaluateFlow(cells, {});
    expect(res.scope.A6).toBe(6);
  });

  test("for (no args) loops until break", async () => {
    const cells: FlowCell[] = [
      { row: 1, col: "A", expr: "count = 0" },
      { row: 2, col: "A", expr: "for" },
      { row: 3, col: "B", expr: "count += 1" },
      { row: 4, col: "B", expr: "if count >= 3" },
      { row: 5, col: "C", expr: "break" },
      { row: 6, col: "A", expr: "count" },
    ];

    const res = await evaluateFlow(cells, {});
    expect(res.scope.A6).toBe(3);
  });

  test("continue skips to next iteration", async () => {
    const cells: FlowCell[] = [
      { row: 1, col: "A", expr: "sum = 0" },
      { row: 2, col: "A", expr: "for 5" },
      { row: 3, col: "B", expr: "if A2 == 3" },
      { row: 4, col: "C", expr: "continue" },
      { row: 5, col: "B", expr: "sum += A2" },
      { row: 6, col: "A", expr: "sum" },
    ];

    const res = await evaluateFlow(cells, {});
    expect(res.scope.A6).toBe(12);
  });

  test("break <cellRef> exits an outer loop", async () => {
    const cells: FlowCell[] = [
      { row: 1, col: "A", expr: "hit = 0" },
      { row: 2, col: "A", expr: "for 3" },
      { row: 3, col: "B", expr: "for 3" },
      { row: 4, col: "C", expr: "if A2 == 2 and B3 == 2" },
      { row: 5, col: "D", expr: "break A2" },
      { row: 6, col: "C", expr: "hit += 1" },
      { row: 7, col: "A", expr: "hit" },
    ];

    const res = await evaluateFlow(cells, {});
    expect(res.scope.A7).toBe(4);
  });

  test("continue <cellRef> continues an outer loop", async () => {
    const cells: FlowCell[] = [
      { row: 1, col: "A", expr: "hit = 0" },
      { row: 2, col: "A", expr: "for 3" },
      { row: 3, col: "B", expr: "for 3" },
      { row: 4, col: "C", expr: "if A2 == 2 and B3 == 3" },
      { row: 5, col: "D", expr: "continue A2" },
      { row: 6, col: "C", expr: "hit += 1" },
      { row: 7, col: "A", expr: "hit" },
    ];

    const res = await evaluateFlow(cells, {});
    expect(res.scope.A7).toBe(8);
  });
});

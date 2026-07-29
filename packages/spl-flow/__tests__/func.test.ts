import { describe, expect, test } from "bun:test";

import { evaluateFlow, type FlowCell } from "../src";

describe("spl-flow func/return", () => {
  test("simple subroutine call returns a value", async () => {
    const cells: FlowCell[] = [
      { row: 1, col: "A", expr: "func" },
      { row: 2, col: "B", expr: "return A1 + B1" },
      { row: 3, col: "A", expr: "func(A1, 1, 2)" },
    ];

    const res = await evaluateFlow(cells, {});
    expect(res.scope.A3).toBe(3);
  });

  test("func bodies do not execute during top-level flow execution", async () => {
    const cells: FlowCell[] = [
      { row: 1, col: "A", expr: "func" },
      { row: 2, col: "B", expr: "x = 1" },
      { row: 3, col: "A", expr: "x = 2" },
      { row: 4, col: "A", expr: "x" },
    ];

    const res = await evaluateFlow(cells, {});
    expect(res.scope.A4).toBe(2);
    expect("B2" in res.scope).toBe(false);
  });

  test("subroutine without explicit return returns last expression value", async () => {
    const cells: FlowCell[] = [
      { row: 1, col: "A", expr: "func" },
      { row: 2, col: "B", expr: "A1 + B1" },
      { row: 3, col: "A", expr: "func(A1, 1, 2)" },
    ];

    const res = await evaluateFlow(cells, {});
    expect(res.scope.A3).toBe(3);
  });
});

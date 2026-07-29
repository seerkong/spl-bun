import { describe, expect, test } from "bun:test";

import { evaluateFlow, type FlowCell } from "../src";

describe("spl-flow if/elseif/else", () => {
  test("multi-row if/elseif/else selects the right branch", async () => {
    const cells: FlowCell[] = [
      { row: 1, col: "A", expr: "if x > 0" },
      { row: 2, col: "B", expr: "x * 2" },
      { row: 3, col: "A", expr: "else if x == 0" },
      { row: 4, col: "B", expr: "100" },
      { row: 5, col: "A", expr: "else" },
      { row: 6, col: "B", expr: "-1" },
    ];

    const res = await evaluateFlow(cells, { scope: { x: 0 } });
    expect(res.scope.B4).toBe(100);
    expect("B2" in res.scope).toBe(false);
    expect("B6" in res.scope).toBe(false);
  });

  test("rejects same-row if/else form in row-unique dialect", async () => {
    const cells: FlowCell[] = [
      { row: 1, col: "A", expr: "if x > 0" },
      { row: 1, col: "B", expr: "10" },
    ];

    await expect(evaluateFlow(cells, { scope: { x: 1 } })).rejects.toThrow(/Multiple executable cells in row 1/);
  });

  test("supports 'elseif' keyword without a space", async () => {
    const cells: FlowCell[] = [
      { row: 1, col: "A", expr: "if x > 0" },
      { row: 2, col: "B", expr: "1" },
      { row: 3, col: "A", expr: "elseif x == 0" },
      { row: 4, col: "B", expr: "2" },
      { row: 5, col: "A", expr: "else" },
      { row: 6, col: "B", expr: "3" },
    ];

    const res = await evaluateFlow(cells, { scope: { x: 0 } });
    expect(res.scope.B4).toBe(2);
    expect("B2" in res.scope).toBe(false);
    expect("B6" in res.scope).toBe(false);
  });
});

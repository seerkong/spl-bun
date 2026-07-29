import { describe, expect, test } from "bun:test";

import { evaluateFlow, type FlowCell } from "../src";

describe("spl-flow result/end", () => {
  test("result terminates flow execution early and returns a value", async () => {
    const cells: FlowCell[] = [
      { row: 1, col: "A", expr: "result 1 + 1" },
      { row: 2, col: "A", expr: "x = 1" },
    ];

    const res = await evaluateFlow(cells, {});
    expect(res.result).toBe(2);
    expect("A2" in res.scope).toBe(false);
  });

  test("end terminates flow with an error message", async () => {
    const cells: FlowCell[] = [
      { row: 1, col: "A", expr: 'end "boom"' },
      { row: 2, col: "A", expr: "1 + 1" },
    ];

    await expect(evaluateFlow(cells, {})).rejects.toThrow(/boom/);
  });

  test("end (no message) terminates flow without throwing", async () => {
    const cells: FlowCell[] = [
      { row: 1, col: "A", expr: "end" },
      { row: 2, col: "A", expr: "x = 1" },
      { row: 3, col: "A", expr: "x" },
    ];

    const res = await evaluateFlow(cells, {});
    expect("A2" in res.scope).toBe(false);
    expect("A3" in res.scope).toBe(false);
  });
});

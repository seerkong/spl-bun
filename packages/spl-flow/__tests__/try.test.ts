import { describe, expect, test } from "bun:test";

import { evaluateFlow, type FlowCell } from "../src";

describe("spl-flow try", () => {
  test("try captures an error and continues", async () => {
    const cells: FlowCell[] = [
      { row: 1, col: "A", expr: "try" },
      { row: 2, col: "B", expr: "unknownFunc()" },
      { row: 3, col: "A", expr: "1 + 1" },
    ];

    const res = await evaluateFlow(cells, {});
    expect(typeof res.scope.A1).toBe("string");
    expect(String(res.scope.A1)).not.toBe("");
    expect(res.scope.A3).toBe(2);
  });

  test("try succeeds and stores null", async () => {
    const cells: FlowCell[] = [
      { row: 1, col: "A", expr: "try" },
      { row: 2, col: "B", expr: "1 + 1" },
      { row: 3, col: "A", expr: "1 + 1" },
    ];

    const res = await evaluateFlow(cells, {});
    expect(res.scope.A1).toBe(null);
    expect(res.scope.A3).toBe(2);
  });
});

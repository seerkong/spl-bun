import { describe, expect, test } from "bun:test";

import { evaluateFlow, type FlowCell } from "../src";

describe("spl-flow goto", () => {
  test("goto jumps to a target cell", async () => {
    const cells: FlowCell[] = [
      { row: 1, col: "A", expr: "x = 0" },
      { row: 2, col: "A", expr: "goto A4" },
      { row: 3, col: "A", expr: "x = 1" },
      { row: 4, col: "A", expr: "x = 2" },
    ];

    const res = await evaluateFlow(cells, {});
    expect(res.scope.A4).toBe(2);
    expect("A3" in res.scope).toBe(false);
  });

  test("goto into deeper indentation is rejected", async () => {
    const cells: FlowCell[] = [
      { row: 1, col: "A", expr: "for 2" },
      { row: 2, col: "B", expr: "x = 1" },
      { row: 3, col: "A", expr: "goto B2" },
    ];

    const res = await evaluateFlow(cells, {});
    const gotoCell = res.cells.find((cell) => cell.row === 3 && cell.col === "A");
    expect(gotoCell?.status).toBe("error");
    expect(String(gotoCell?.error)).toContain("deeper indentation");
  });
});

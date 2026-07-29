import { describe, expect, test } from "bun:test";

import type { FlowCell } from "../src";
import { buildFlowGrid } from "../src/flow/grid";
import { getCodeBlockEndRow, setNext } from "../src/flow/navigation";

describe("spl-flow navigation", () => {
  test("getCodeBlockEndRow ignores blank/comment cells in outer columns", () => {
    const cells: FlowCell[] = [
      { row: 1, col: "A", expr: "if true" },
      { row: 2, col: "B", expr: "1" },
      { row: 3, col: "B", expr: "2" },

      // Comment in the if's column should not close the block.
      { row: 4, col: "A", expr: "// comment" },
      { row: 5, col: "B", expr: "3" },

      // A non-blank expression at the if's column closes the block.
      { row: 6, col: "A", expr: "999" },
    ];

    const grid = buildFlowGrid(cells);
    const a1 = grid.getCellByRef("A1");
    expect(getCodeBlockEndRow(grid, a1.row, a1.colIndex)).toBe(5);
  });

  test("getCodeBlockEndRow ends before sibling branch at same indentation", () => {
    const cells: FlowCell[] = [
      { row: 1, col: "A", expr: "if true" },
      { row: 2, col: "B", expr: "1" },
      { row: 3, col: "B", expr: "2" },
      { row: 4, col: "A", expr: "else" },
      { row: 5, col: "B", expr: "3" },
    ];

    const grid = buildFlowGrid(cells);
    const a1 = grid.getCellByRef("A1");
    expect(getCodeBlockEndRow(grid, a1.row, a1.colIndex)).toBe(3);
  });

  test("setNext skips blank/comment cells and advances row-major", () => {
    const cells: FlowCell[] = [
      { row: 1, col: "A", expr: "  " },
      { row: 2, col: "A", expr: "// comment" },
      { row: 3, col: "C", expr: "1" },
      { row: 4, col: "A", expr: "2" },
    ];
    const grid = buildFlowGrid(cells);

    const next1 = setNext(grid, { row: 1, colIndex: 1 }, false, []);
    expect(next1).toEqual({ row: 3, colIndex: 3 });

    const next2 = setNext(grid, { row: next1!.row, colIndex: next1!.colIndex + 1 }, false, []);
    expect(next2).toEqual({ row: 4, colIndex: 1 });
  });
});

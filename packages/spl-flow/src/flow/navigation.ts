import type { FlowGrid } from "./grid";

export type FlowLocation = { row: number; colIndex: number };

export type FlowStackFrame = {
  type: "for" | "try";
  row: number;
  colIndex: number;
  blockEndRow: number;
};

export function getCodeBlockEndRow(grid: FlowGrid, startRow: number, startColIndex: number): number {
  const totalRows = grid.maxRow;
  const startCol = Math.trunc(startColIndex);

  if (!Number.isFinite(startRow) || !Number.isFinite(startColIndex) || startRow <= 0 || startCol <= 0) {
    throw new Error("getCodeBlockEndRow expects 1-based positive row/colIndex");
  }

  for (let row = startRow + 1; row <= totalRows; row++) {
    for (let colIndex = 1; colIndex <= startCol; colIndex++) {
      const cell = grid.getCell(row, colIndex);

      // Block boundary is determined by a non-empty, non-comment cell appearing at the same
      // indentation or more-left indentation. Blank/comment cells do not close the block.
      if (cell.kind !== "blank" && cell.kind !== "comment") {
        return row - 1;
      }
    }
  }
  return totalRows;
}

export function setNext(
  grid: FlowGrid,
  start: FlowLocation,
  checkStack: boolean,
  stack: FlowStackFrame[],
): FlowLocation | null {
  let row = Math.trunc(start.row);
  let colIndex = Math.trunc(start.colIndex);
  let isCheckStack = checkStack;

  if (!Number.isFinite(start.row) || !Number.isFinite(start.colIndex) || row <= 0 || colIndex <= 0) {
    throw new Error("setNext expects 1-based positive row/colIndex");
  }

  while (true) {
    if (colIndex > grid.maxColIndex) {
      row += 1;
      colIndex = 1;
      isCheckStack = true;
    }

    if (row > grid.maxRow) {
      return null;
    }

    if (isCheckStack) {
      while (stack.length > 0) {
        const top = stack[0];
        if (row > top.blockEndRow) {
          if (top.type === "for") {
            // Loop continues: jump back to the for statement cell.
            row = top.row;
            colIndex = top.colIndex;
            isCheckStack = false;
            break;
          }

          // Non-loop scopes just pop.
          stack.shift();
          continue;
        }
        break;
      }
    }

    const cell = grid.getCell(row, colIndex);
    if (cell.kind === "blank" || cell.kind === "comment") {
      colIndex += 1;
      isCheckStack = false;
      continue;
    }

    return { row, colIndex };
  }
}

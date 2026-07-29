import type { FlowCell } from "../index";

export type FlowCellKind = "blank" | "comment" | "expression" | "command";

export type FlowCommandKind =
  | "if"
  | "else"
  | "elseif"
  | "for"
  | "break"
  | "continue"
  | "goto"
  | "func"
  | "return"
  | "result"
  | "end"
  | "try";

export type FlowCommand = {
  kind: FlowCommandKind;
  rawArgs: string;
};

export type FlowGridCell = {
  row: number;
  col: string;
  colIndex: number;
  cellRef: string;
  raw: string;
  kind: FlowCellKind;
  normalizedExpr?: string;
  executeOnly?: boolean;
  command?: FlowCommand;
};

export type FlowGrid = {
  maxRow: number;
  maxColIndex: number;
  cells: FlowGridCell[];
  getCellByRef: (cellRef: string) => FlowGridCell;
  getCell: (row: number, col: string | number) => FlowGridCell;
};

export function colToIndex(colInput: string): number {
  const col = String(colInput).trim().toUpperCase();
  if (col.length === 0) {
    throw new Error("Column must be a non-empty string");
  }

  let value = 0;
  for (let i = 0; i < col.length; i++) {
    const code = col.charCodeAt(i);
    if (code < 65 || code > 90) {
      throw new Error(`Invalid column: '${colInput}'`);
    }
    value = value * 26 + (code - 64);
  }

  return value;
}

export function indexToCol(indexInput: number): string {
  const index = Math.trunc(indexInput);
  if (!Number.isFinite(indexInput) || index <= 0) {
    throw new Error(`Invalid column index: ${indexInput}`);
  }

  let n = index;
  let out = "";
  while (n > 0) {
    // 1 -> A, 26 -> Z, 27 -> AA
    n -= 1;
    out = String.fromCharCode(65 + (n % 26)) + out;
    n = Math.floor(n / 26);
  }
  return out;
}

export function parseCellRef(cellRefInput: string): { row: number; col: string; colIndex: number; cellRef: string } {
  const raw = String(cellRefInput).trim();
  const match = raw.match(/^([A-Za-z]+)(\d+)$/);
  if (!match) {
    throw new Error(`Invalid cell reference: '${cellRefInput}'`);
  }
  const col = match[1].toUpperCase();
  const row = Number(match[2]);
  if (!Number.isFinite(row) || row <= 0 || !Number.isInteger(row)) {
    throw new Error(`Invalid cell reference: '${cellRefInput}'`);
  }

  const colIndex = colToIndex(col);
  return { row, col, colIndex, cellRef: `${col}${row}` };
}

function normalizeRow(rowInput: unknown): number {
  const row = typeof rowInput === "number" ? rowInput : Number(rowInput);
  if (!Number.isFinite(row) || row <= 0 || !Number.isInteger(row)) {
    throw new Error(`Invalid row: ${String(rowInput)}`);
  }
  return row;
}

function normalizeCol(colInput: unknown): { col: string; colIndex: number } {
  const col = String(colInput).trim().toUpperCase();
  const colIndex = colToIndex(col);
  return { col, colIndex };
}

export function parseCommandCell(textInput: string): FlowCommand | null {
  const text = String(textInput).trim();
  if (text.length === 0) return null;

  // Order matters: else-if must be checked before else.
  const elseIfMatch = text.match(/^else\s+if(?:\s|$)/i);
  if (elseIfMatch) {
    const rawArgs = text.slice(elseIfMatch[0].length).trim();
    return { kind: "elseif", rawArgs };
  }

  // Statements are keyword-based and require whitespace (or end-of-cell) after the keyword.
  // This avoids mis-classifying expression calls like `if(...)` as a statement.
  const keywordMatch = text.match(/^([A-Za-z]+)(?=\s|$)/);
  if (!keywordMatch) return null;

  const keyword = keywordMatch[1].toLowerCase();
  const rawArgs = text.slice(keywordMatch[0].length).trim();

  // Disambiguate statement keywords vs. identifiers used in assignments.
  // Example: `end = datetime(...)` should remain an expression assigning to a variable named `end`,
  // not the `end` flow-control command.
  if (/^(=|\+=|-=|\*=|\/=|%=)/.test(rawArgs)) {
    return null;
  }

  switch (keyword) {
    case "if":
      return { kind: "if", rawArgs };
    case "else":
      return { kind: "else", rawArgs };
    case "elseif":
      return { kind: "elseif", rawArgs };
    case "for":
      return { kind: "for", rawArgs };
    case "break":
      return { kind: "break", rawArgs };
    case "continue":
      return { kind: "continue", rawArgs };
    case "goto":
      return { kind: "goto", rawArgs };
    case "func":
      return { kind: "func", rawArgs };
    case "return":
      return { kind: "return", rawArgs };
    case "result":
      return { kind: "result", rawArgs };
    case "end":
      return { kind: "end", rawArgs };
    case "try":
      return { kind: "try", rawArgs };
    default:
      return null;
  }
}

export function classifyCellText(
  rawInput: string,
): Pick<FlowGridCell, "kind" | "normalizedExpr" | "command" | "executeOnly"> {
  const raw = String(rawInput);
  const trimmed = raw.trim();

  if (trimmed.length === 0) {
    return { kind: "blank" };
  }

  // TS dialect: only '//' starts a comment cell. Single '/' is NOT a comment.
  if (trimmed.startsWith("//")) {
    return { kind: "comment" };
  }

  const command = parseCommandCell(trimmed);
  if (command) {
    return { kind: "command", command };
  }

  let expression = trimmed;
  let executeOnly = false;
  if (expression.startsWith("=")) {
    expression = expression.slice(1).trimStart();
  } else if (expression.startsWith(">")) {
    expression = expression.slice(1).trimStart();
    executeOnly = true;
  }

  return { kind: "expression", normalizedExpr: expression, executeOnly };
}

function makeBlankCell(row: number, col: string): FlowGridCell {
  const colNormalized = String(col).trim().toUpperCase();
  const colIndex = colToIndex(colNormalized);
  return {
    row,
    col: colNormalized,
    colIndex,
    cellRef: `${colNormalized}${row}`,
    raw: "",
    kind: "blank",
  };
}

export function buildFlowGrid(flowCells: FlowCell[]): FlowGrid {
  type Normalized = {
    row: number;
    col: string;
    colIndex: number;
    cellRef: string;
    raw: string;
    trimmed: string;
  };

  // First normalize inputs and reject duplicates early.
  const normalizedCells: Normalized[] = [];
  const seenRefs = new Set<string>();
  for (const cell of flowCells) {
    const row = normalizeRow(cell.row);
    const { col, colIndex } = normalizeCol(cell.col);
    const cellRef = `${col}${row}`;
    const raw = cell.expr ?? "";
    const trimmed = String(raw).trim();

    if (seenRefs.has(cellRef)) {
      throw new Error(`Duplicate cell definition: ${cellRef}`);
    }
    // TS dialect: `next` is not supported; reject with a clear hint.
    if (/^next(?:\s|$)/i.test(trimmed)) {
      throw new Error("next is not supported; use continue");
    }

    seenRefs.add(cellRef);
    normalizedCells.push({ row, col, colIndex, cellRef, raw, trimmed });
  }

  // Group by row so we can apply the TS dialect rules:
  // 1) comment rows truncate the remainder of the row
  // 2) after truncation, each row can have at most one executable cell (command/expression)
  const cellsByRow = new Map<number, Normalized[]>();
  for (const cell of normalizedCells) {
    const list = cellsByRow.get(cell.row);
    if (list) list.push(cell);
    else cellsByRow.set(cell.row, [cell]);
  }

  const byRef = new Map<string, FlowGridCell>();
  let maxRow = 0;
  let maxColIndex = 0;

  const rows = [...cellsByRow.keys()].sort((a, b) => a - b);
  for (const row of rows) {
    const rowCells = [...(cellsByRow.get(row) ?? [])].sort((a, b) => a.colIndex - b.colIndex);

    // Find leftmost comment cell (if any). Only '//' starts a comment cell.
    let commentCutoff: number | null = null;
    for (const cell of rowCells) {
      if (cell.trimmed.startsWith("//")) {
        commentCutoff = commentCutoff === null ? cell.colIndex : Math.min(commentCutoff, cell.colIndex);
      }
    }

    const kept = commentCutoff === null ? rowCells : rowCells.filter((cell) => cell.colIndex <= commentCutoff);

    let executableCount = 0;
    for (const cell of kept) {
      const classified = classifyCellText(cell.raw);
      if (classified.kind === "command" || classified.kind === "expression") {
        executableCount += 1;
      }
    }
    if (executableCount > 1) {
      const executableRefs = kept
        .map((cell) => {
          const kind = classifyCellText(cell.raw).kind;
          return kind === "command" || kind === "expression" ? cell.cellRef : null;
        })
        .filter((v): v is string => Boolean(v));
      const details = executableRefs.length ? ` (${executableRefs.join(", ")})` : "";
      throw new Error(`Multiple executable cells in row ${row} are not allowed${details}`);
    }

    for (const cell of kept) {
      const classified = classifyCellText(cell.raw);
    const gridCell: FlowGridCell = {
      row: cell.row,
      col: cell.col,
      colIndex: cell.colIndex,
      cellRef: cell.cellRef,
      raw: cell.raw,
      kind: classified.kind,
      normalizedExpr: classified.normalizedExpr,
      executeOnly: classified.executeOnly,
      command: classified.command,
    };
      byRef.set(cell.cellRef, gridCell);
      maxRow = Math.max(maxRow, cell.row);
      maxColIndex = Math.max(maxColIndex, cell.colIndex);
    }
  }

  const cells = [...byRef.values()].sort((a, b) => {
    if (a.row !== b.row) return a.row - b.row;
    return a.colIndex - b.colIndex;
  });

  const getCellByRef = (cellRefInput: string): FlowGridCell => {
    const parsed = parseCellRef(cellRefInput);
    return byRef.get(parsed.cellRef) ?? makeBlankCell(parsed.row, parsed.col);
  };

  const getCell = (rowInput: number, colInput: string | number): FlowGridCell => {
    const row = normalizeRow(rowInput);
    const col = typeof colInput === "number" ? indexToCol(colInput) : String(colInput);
    const { col: colNormalized } = normalizeCol(col);
    const ref = `${colNormalized}${row}`;
    return byRef.get(ref) ?? makeBlankCell(row, colNormalized);
  };

  return {
    maxRow,
    maxColIndex,
    cells,
    getCellByRef,
    getCell,
  };
}

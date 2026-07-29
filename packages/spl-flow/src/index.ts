import { parseJsonPreservingNumbers, stringifySplJson } from "depa-data-expression";
import { FlowResources, type FlowResourceEvent } from "./resources";
import { workspaceFile } from "./file-effect";
import { parseCsvTable, tableFromRecords } from "./table-input";
export { parseCsvTable, tableFromRecords, importTable, type TableData, type ImportedTable } from "./table-input";
export { queryTableSqlite } from "./datasource/query-table";
export { openCsvCursor, type CsvCursorOptions } from "./datasource/csv-cursor";
export { openSqliteCursor, type SqliteCursorOptions } from "depa-data-sqlite-adapter";
import {
  Cursor,
  compileExpression,
  defaultMemberRegistry,
  FunctionRegistryBuilder,
  makeDbHandle,
  makeFileHandle,
  truthy,
  type FunctionRegistry,
} from "depa-data-expression";
import { DataSet } from "depa-data-core";
import { mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname, extname, isAbsolute, resolve as resolvePath, sep } from "path";
import * as XLSX from "xlsx";
import { ConnectionRegistry } from "./connection/registry";
import { createDataSourceHandle } from "./connection/handle";
import { DataSourceFactory } from "./datasource/factory";
import type { DataSourceConfig } from "./datasource/types";
import { buildFlowGrid, indexToCol, parseCellRef } from "./flow/grid";
import { getCodeBlockEndRow, setNext, type FlowLocation, type FlowStackFrame } from "./flow/navigation";

export type FlowStepKind = "expr" | "query";

export interface FlowCell {
  row: number;
  col: string;
  expr: string;
}

export interface FlowResult {
  kind: FlowStepKind;
  value: unknown;
}

export interface FlowAstCell {
  type: "expression";
  id: string;
  position: {
    row: number;
    col: string;
  };
  expr: string;
}

export interface FlowAstSequence {
  type: "sequence";
  block: FlowAstCell[][];
}

export type FlowAst = FlowAstSequence;

export interface DBConnection {
  name: string;
  type: "sqlite" | "jdbc" | string;
  path?: string;
  driver?: string;
  url?: string;
}

export interface FlowExecutionContext {
  signal?:AbortSignal;
  /** Run-owned runtime; evaluateFlow creates its own scope. */
  resources?: FlowResources;
  executionMode?: "sync" | "async";
  observeResource?: (event: FlowResourceEvent) => void;
  scope?: Record<string, unknown>;
  connections?: Map<string, DBConnection>;
  dataSourceConfigs?: DataSourceConfig[];
  defaultDbPath?: string;
  workspaceRoot?: string;
  adapters?: {
    sqliteQuery?: (options: { connection?: DBConnection; dbPath?: string; sql: string; params?: unknown[] }) => unknown | Promise<unknown>;
    sqliteExecute?: (options: { connection?: DBConnection; dbPath?: string; sql: string; params?: unknown[] }) => unknown | Promise<unknown>;
    connect?: (name: string) => DBConnection | Promise<DBConnection>;
  };
}

export interface FlowCellEvaluation {
  row: number;
  col: string;
  expr: string;
  status: "ok" | "error";
  result?: unknown;
  error?: string;
}

export interface FlowEvaluationResult {
  cells: FlowCellEvaluation[];
  lastQuery?: unknown;
  result?: unknown;
  scope: Record<string, unknown>;
}

type QueryResultData = { columns: string[]; rows: Record<string, unknown>[] };

type DataSetLike = {
  rows: Record<string, unknown>[];
  schema?: { name: string }[];
};

type ResolvedConnectArgs =
  | { kind: "name"; name: string }
  | { kind: "sqlite"; path: string };

function getWorkspaceRoot(ctx: FlowExecutionContext): string {
  const root = typeof ctx.workspaceRoot === "string" && ctx.workspaceRoot.trim().length > 0
    ? ctx.workspaceRoot
    : process.cwd();
  return root;
}

function resolveWorkspacePath(input: string, ctx: FlowExecutionContext): string {
  const root = getWorkspaceRoot(ctx);
  const rootResolved = resolvePath(root);
  const resolved = isAbsolute(input) ? resolvePath(input) : resolvePath(rootResolved, input);
  const rootPrefix = rootResolved.endsWith(sep) ? rootResolved : rootResolved + sep;
  if (resolved !== rootResolved && !resolved.startsWith(rootPrefix)) {
    throw new Error("Path escapes workspace root");
  }
  return resolved;
}

function parseConnectArgs(nameOrType: unknown, maybePath: unknown): ResolvedConnectArgs {
  if (typeof nameOrType !== "string" || nameOrType.trim().length === 0) {
    throw new Error("connect() expects string arguments");
  }
  const first = nameOrType.trim();
  if (maybePath === undefined) {
    return { kind: "name", name: first };
  }
  if (typeof maybePath !== "string" || maybePath.trim().length === 0) {
    throw new Error("connect(driver, url) expects string arguments");
  }
  const second = maybePath.trim();
  const type = first.toLowerCase();
  if (type !== "sqlite") {
    throw new Error("Only connect(\"sqlite\", path) is supported in spl-flow runtime");
  }
  return { kind: "sqlite", path: second };
}

function parseCsvContent(content: string, delimiter = ","): { rows: Record<string, unknown>[]; schema: { name: string; type?: string }[] } {
  const data = parseCsvTable(content, { delimiter });
  return { rows: data.rows, schema: data.columns.map((name) => ({ name, type: "unknown" })) };
}

function makeRuntimeFunctions(ctx: FlowExecutionContext): FunctionRegistry {
  const registry = ctx.resources!.registry;

  const connectFn = (nameOrType?: unknown, maybePath?: unknown): unknown => {
    if (nameOrType === undefined) {
      throw new Error("connect() requires at least 1 argument");
    }
    const parsed = parseConnectArgs(nameOrType, maybePath);

    if (parsed.kind === "name") {
      const name = parsed.name;
      if (ctx.connections?.has(name)) {
        return createDbHandle(resolveConnection(name, ctx), ctx);
      }
      const ds = registry.get(name);
      if (ds) {
        return managedDataSourceHandle(ds,ctx);
      }
      throw new Error(`Connection '${name}' not found`);
    }

    const resolvedPath = resolveWorkspacePath(parsed.path, ctx);
    const ds = DataSourceFactory.create({ type: "sqlite", name: "sqlite", path: resolvedPath });
    ctx.resources!.own({close:()=>ds.close?.()},"dynamic sqlite","connection");
    return managedDataSourceHandle(ds,ctx);
  };

  const fileFn = (path?: unknown): unknown => {
    if (typeof path !== "string" || path.trim().length === 0) {
      throw new Error("file() expects a path string");
    }
    const resolved = resolveWorkspacePath(path.trim(), ctx);
    return makeFileHandle({
      ...workspaceFile(resolved,ctx.workspaceRoot ?? process.cwd(),{allowAsync:ctx.executionMode!=="sync",signal:ctx.signal,own:cursor=>ctx.resources!.own(cursor,resolved)}),
    });
  };

  const csvFn = (content?: unknown): unknown => {
    if (typeof content !== "string") {
      throw new Error("csv() expects CSV string content");
    }
    return parseCsvContent(content);
  };

  type ExcelIoOptions = { sheet?: string | number; header?: boolean };

  type CallArgGroupsValue = unknown[][];

  function isCallArgGroupsValue(value: unknown): value is CallArgGroupsValue {
    return Array.isArray(value) && value.every((v) => Array.isArray(v));
  }

  function isExcelOptionsObject(value: unknown): boolean {
    if (!value || typeof value !== "object" || Array.isArray(value)) return false;
    const obj = value as Record<string, unknown>;
    return "sheet" in obj || "header" in obj;
  }

  function parseExcelSheet(value: unknown): string | number | undefined {
    if (typeof value === "string") return value;
    if (typeof value === "number") return value;
    if (value === undefined) return undefined;
    throw new Error("T() sheet must be a string (name) or number (1-based index)");
  }

  function readExcelTable(filePath: string, options: ExcelIoOptions): DataSetLike {
    const buf = readFileSync(filePath);
    const wb = XLSX.read(buf, { type: "buffer", cellDates: true });

    const sheetName = (() => {
      const requested = options.sheet;
      if (requested === undefined) return wb.SheetNames[0];
      if (typeof requested === "number") {
        const idx = Math.trunc(requested) - 1;
        if (idx < 0 || idx >= wb.SheetNames.length) {
          throw new Error(`T() invalid sheet index: ${requested}`);
        }
        return wb.SheetNames[idx];
      }
      if (typeof requested === "string") {
        if (!wb.SheetNames.includes(requested)) {
          throw new Error(`T() sheet not found: ${requested}`);
        }
        return requested;
      }
      return wb.SheetNames[0];
    })();

    if (!sheetName) return { rows: [], schema: [] };
    const ws = wb.Sheets[sheetName];
    if (!ws) return { rows: [], schema: [] };

    const header = options.header !== false;
    if (header) {
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: null, blankrows: false });
      const schema = rows.length > 0
        ? Object.keys(rows[0]).map((name) => ({ name, type: "unknown" }))
        : [];
      return { rows, schema };
    }

    const matrix = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: null, blankrows: false }) as unknown[][];
    const width = matrix.reduce((acc, row) => Math.max(acc, Array.isArray(row) ? row.length : 0), 0);
    const keys = Array.from({ length: width }, (_, i) => `#${i + 1}`);

    const rows = matrix
      .filter((row) => Array.isArray(row) && row.some((v) => v !== null && v !== undefined && v !== ""))
      .map((row) => {
        const record: Record<string, unknown> = {};
        keys.forEach((key, idx) => {
          record[key] = (row as unknown[])[idx] ?? null;
        });
        return record;
      });

    return { rows, schema: keys.map((name) => ({ name, type: "unknown" })) };
  }

  function extractExportTable(data: unknown): { rows: Record<string, unknown>[]; columns: string[] } {
    const asRecordRows = (rows: unknown[]): Record<string, unknown>[] =>
      rows.filter((row): row is Record<string, unknown> => Boolean(row && typeof row === "object" && !Array.isArray(row)));

    if (Array.isArray(data)) {
      const rows = asRecordRows(data);
      const columns = rows.length > 0 ? Object.keys(rows[0]) : [];
      return { rows, columns };
    }

    if (isDataSetLike(data)) {
      const rows = asRecordRows(data.rows ?? []);
      const schemaColumns = Array.isArray(data.schema) ? data.schema.map((col) => col.name) : [];
      const resultColumns = schemaColumns.length > 0 ? schemaColumns : (rows.length > 0 ? Object.keys(rows[0]) : []);
      return { rows, columns: resultColumns };
    }

    throw new Error("T() Excel export expects array-of-records or { rows: [...] }");
  }

  function writeExcelFile(filePath: string, data: unknown, options: ExcelIoOptions): void {
    const { rows, columns } = extractExportTable(data);
    const header = options.header !== false;

    const jsonOpts: Record<string, unknown> = { skipHeader: !header };
    if (columns.length > 0) {
      jsonOpts.header = columns;
    }

    const ws = XLSX.utils.json_to_sheet(rows, jsonOpts as never);
    const wb = XLSX.utils.book_new();

    const rawSheet = options.sheet;
    const sheetName = typeof rawSheet === "string" && rawSheet.trim().length > 0
      ? rawSheet
      : typeof rawSheet === "number" && Number.isFinite(rawSheet)
        ? `Sheet${Math.trunc(rawSheet)}`
        : "Sheet1";

    XLSX.utils.book_append_sheet(wb, ws, sheetName);

    mkdirSync(dirname(filePath), { recursive: true });

    const ext = extname(filePath).toLowerCase();
    const bookType = ext === ".xls" ? "biff8" : "xlsx";
    const out = XLSX.write(wb, { bookType: bookType as never, type: "buffer" }) as unknown as Uint8Array;
    writeFileSync(filePath, out);
  }

  const tFn = (...rawArgs: unknown[]): unknown => {
    const args = [...rawArgs];
    const path = args.shift();
    if (typeof path !== "string" || path.trim().length === 0) {
      throw new Error("T() expects a path string");
    }
    const sourcePath = path.trim();
    const resolved = resolveWorkspacePath(sourcePath, ctx);
    const ext = extname(resolved).toLowerCase();

    // Expression evaluator appends:
    // - argGroups (evaluated, nested arrays) when semicolon groups exist
    // - option string when @ options exist
    let option: string | undefined;
    if (args.length >= 1) {
      const last = args[args.length - 1];
      const prev = args.length >= 2 ? args[args.length - 2] : undefined;
      const looksLikeOption = (value: unknown) =>
        typeof value === "string" && value.length > 0 && /^[a-z0-9]+$/.test(value);

      // When semicolon groups are present, the option (if any) must follow the argGroups value.
      if (looksLikeOption(last) && isCallArgGroupsValue(prev)) {
        option = last as string;
        args.pop();
      } else if (looksLikeOption(last)) {
        // Without semicolon groups, treat the last string as an option only for the supported
        // Excel subset (avoids mis-reading sheet names as options).
        const candidate = last as string;
        if (/^[bc]+$/.test(candidate)) {
          option = candidate;
          args.pop();
        }
      }
    }

    let argGroups: CallArgGroupsValue | undefined;
    if (args.length >= 1 && isCallArgGroupsValue(args[args.length - 1])) {
      argGroups = args.pop() as CallArgGroupsValue;
    }

    // Support a small parity subset for Excel T():
    // - @b: no header/title row (default: has header)
    // - @c: cursor mode is NOT implemented yet (xlsx-only in Java)
    if (option) {
      if (option.includes("c")) {
        throw new Error("T@c cursor mode is not supported yet (xlsx-only in Java SPL)");
      }
      const unsupported = option.replace(/[bc]/g, "");
      if (unsupported.length > 0) {
        throw new Error(`T() unsupported option(s): ${unsupported}`);
      }
    }

    if (ext === ".xls" || ext === ".xlsx") {
      const header = !(option && option.includes("b"));

      let sheet: string | number | undefined;
      let data: unknown;

      if (argGroups) {
        const g1 = argGroups[0] ?? [];
        const g2 = argGroups[1] ?? [];

        if (argGroups.length > 2) {
          throw new Error("T() too many ';' groups for Excel");
        }
        if (g2.length > 1) {
          throw new Error("T() Excel sheet group must have at most 1 argument");
        }

        data = g1.length >= 2 ? g1[1] : undefined;
        sheet = parseExcelSheet(g2[0]);
      } else {
        data = args[0];

        // Excel sheet selection must use semicolon syntax: `T(path; sheet)` or `T(path, data; sheet)`.
        if (typeof data === "string" || typeof data === "number") {
          throw new Error("T() Excel sheet selection requires ';' groups: use T(path; sheet) or T(path, data; sheet)");
        }
      }

      // BREAKING: remove the TS-only options-object forms.
      if (isExcelOptionsObject(data) || isExcelOptionsObject(args[1])) {
        throw new Error(
          "T() Excel options-object form is no longer supported; use semicolon groups for sheet and @b for no-header",
        );
      }

      const excelOptions: ExcelIoOptions = { sheet, header };
      if (data === undefined) {
        return readExcelTable(resolved, excelOptions);
      }
      writeExcelFile(resolved, data, excelOptions);
      return sourcePath;
    }

    const content = readFileSync(resolved, "utf-8");
    if (ext === ".csv") {
      if (args[0] !== undefined) throw new Error("T() CSV does not support export");
      return parseCsvContent(content);
    }
    if (ext === ".json") {
      if (args[0] !== undefined) throw new Error("T() JSON does not support export");
      const data = tableFromRecords(parseJsonPreservingNumbers(content));
      return {rows:data.rows,schema:data.columns.map(name=>({name,type:"unknown"}))};
    }
    throw new Error(`T() unsupported file type: ${ext || "(none)"}`);
  };

  return new FunctionRegistryBuilder()
    .add("connect", connectFn)
    .add("file", fileFn)
    .add("csv", csvFn)
    .add("t", tFn)
    .build();
}

function toCellRef(row: number, col: string): string {
  return `${String(col).toUpperCase()}${row}`;
}

function resolveConnection(name: string, ctx: FlowExecutionContext): DBConnection {
  const connection = ctx.connections?.get(name);
  if (connection) {
    return connection;
  }
  throw new Error(`Connection '${name}' not found`);
}

function inferConnectionName(expression: string): string | null {
  const match = expression.match(/^\s*([a-zA-Z_][\w]*)\s*\./);
  return match ? match[1] : null;
}

function ensureDbHandles(scope: Record<string, unknown>, ctx: FlowExecutionContext) {
  for (const config of ctx.dataSourceConfigs ?? []) {
    const dataSource=ctx.resources!.registry.get(config.name);
    if(dataSource && !(config.name in scope)) scope[config.name]=managedDataSourceHandle(dataSource,ctx);
  }
  if (!ctx.connections) return;
  for (const [name, connection] of ctx.connections.entries()) {
    if (!(name in scope)) {
      scope[name] = createDbHandle(connection, ctx);
    }
  }
}

function createDbHandle(connection: DBConnection, ctx: FlowExecutionContext) {
  return makeDbHandle({
    name: connection.name,
    type: connection.type,
    query: (sql: string, ...params: unknown[]) => {
      const adapter = ctx.adapters?.sqliteQuery;
      if (!adapter) {
        throw new Error("No sqliteQuery adapter provided for query()");
      }
      return adapter({
        connection,
        dbPath: ctx.defaultDbPath,
        sql,
        params: params.length ? params : undefined,
      });
    },
    execute: (sql: string, ...params: unknown[]) => {
      const adapter = ctx.adapters?.sqliteExecute ?? ctx.adapters?.sqliteQuery;
      if (!adapter) {
        throw new Error("No sqliteExecute adapter provided for execute()");
      }
      return adapter({
        connection,
        dbPath: ctx.defaultDbPath,
        sql,
        params: params.length ? params : undefined,
      });
    },
    commit: () => {
      if (!ctx.adapters?.sqliteExecute) {
        throw new Error("No sqliteExecute adapter provided for commit()");
      }
      return ctx.adapters.sqliteExecute({
        connection,
        dbPath: ctx.defaultDbPath,
        sql: "commit",
      });
    },
    rollback: () => {
      if (!ctx.adapters?.sqliteExecute) {
        throw new Error("No sqliteExecute adapter provided for rollback()");
      }
      return ctx.adapters.sqliteExecute({
        connection,
        dbPath: ctx.defaultDbPath,
        sql: "rollback",
      });
    },
  });
}

function resolveExpressionFunctions(ctx: FlowExecutionContext): FunctionRegistry {
  return makeRuntimeFunctions(ctx);
}

function resolveQQuery(expression: string, ctx: FlowExecutionContext, scope: Record<string, unknown>) {
  if (!expression.trim().startsWith("$q(")) return null;
  const adapter = ctx.adapters?.sqliteQuery;
  if (!adapter) {
    throw new Error("No sqliteQuery adapter provided for $q() execution");
  }
  const match = expression.match(/^\s*\$q\((.*)\)\s*$/s);
  if (!match) return null;
  const inner = match[1];
  const compiled = compileExpression(inner, resolveExpressionFunctions(ctx), defaultMemberRegistry);
  const argValue = compiled.evaluate(scope);
  const sql = typeof argValue === "string" ? argValue : null;
  if (!sql) {
    throw new Error("$q() requires SQL string argument");
  }
  return adapter({
    dbPath: ctx.defaultDbPath,
    sql,
  });
}

export function buildFlowAst(cells: FlowCell[]): FlowAst {
  const normalized = cells.map((cell) => {
    const col = String(cell.col).toUpperCase();
    const row = Number(cell.row);
    const id = `${col}${row}`;
    return {
      type: "expression",
      id,
      position: { row, col },
      expr: cell.expr,
    } as FlowAstCell;
  });
  const ordered = [...normalized].sort((a, b) => {
    if (a.position.row !== b.position.row) return a.position.row - b.position.row;
    return a.position.col.localeCompare(b.position.col);
  });
  return {
    type: "sequence",
    block: [ordered],
  };
}

/** evaluateFlowSync 遇到真异步值（pending Promise）时抛出的错误。 */
export class FlowAsyncValueError extends Error {
  constructor() {
    super(
      "evaluateFlowSync: evaluation produced an asynchronous value (Promise). " +
        "Async adapters/data sources are only supported by evaluateFlow; use evaluateFlow instead.",
    );
    this.name = "FlowAsyncValueError";
  }
}

/** 求值核心的生成器形态：yield 出需要 await 的值，由驱动器决定同步/异步语义。 */
type FlowGen<T> = Generator<unknown, T, unknown>;

/** 异步驱动：await 每个 yield 出的值（Promise 或普通值），拒绝时抛回生成器。 */
async function driveAsync<T>(gen: FlowGen<T>): Promise<T> {
  let step = gen.next();
  while (!step.done) {
    let input: unknown;
    try {
      input = await step.value;
    } catch (error) {
      step = gen.throw(error);
      continue;
    }
    step = gen.next(input);
  }
  return step.value;
}

/**
 * 同步驱动：核心只在单元格求值产出 Promise 时才 yield，因此任何 yield 都
 * 意味着遇到了真异步 adapter/数据源 → 直接抛错（不回抛进生成器，避免被
 * 单元格级 catch 吞掉），提示改用 evaluateFlow。
 */
function driveSync<T>(gen: FlowGen<T>): T {
  const step = gen.next();
  if (!step.done) {
    if(step.value instanceof Promise)void step.value.catch(()=>{});
    gen.return(undefined as never);
    throw new FlowAsyncValueError();
  }
  return step.value;
}

export async function evaluateFlow(
  cells: FlowCell[],
  ctx: FlowExecutionContext,
): Promise<FlowEvaluationResult> {
  const resources=new FlowResources(ctx.observeResource);
  const runtime={...ctx,resources,executionMode:"async" as const};
  const aborted=()=>{void Promise.resolve(resources.close()).catch(()=>{});};
  ctx.signal?.addEventListener("abort",aborted,{once:true});
  try {
    if(ctx.signal?.aborted)throw ctx.signal.reason ?? new Error("Flow cancelled");
    for(const config of ctx.dataSourceConfigs ?? [])resources.registry.register(config);
    return await driveAsync(evaluateFlowCore(cells,runtime,driveAsync));
  } finally {ctx.signal?.removeEventListener("abort",aborted);await resources.close();}
}

/**
 * evaluateFlow 的全同步变体：与 evaluateFlow 共享同一求值核心（单一实现，
 * 语义一致），仅支持同步 adapter/数据源路径；遇到真异步值（Promise）时抛
 * FlowAsyncValueError 提示改用 evaluateFlow。
 */
export function evaluateFlowSync(
  cells: FlowCell[],
  ctx: FlowExecutionContext,
): FlowEvaluationResult {
  const resources=new FlowResources(ctx.observeResource);
  const runtime={...ctx,resources,executionMode:"sync" as const};
  try {
    if(ctx.signal?.aborted)throw ctx.signal.reason ?? new Error("Flow cancelled");
    for(const config of ctx.dataSourceConfigs ?? [])resources.registry.register(config);
    return driveSync(evaluateFlowCore(cells,runtime,driveSync));
  } finally {
    const closing=resources.close();
    if(closing instanceof Promise){void closing.catch(()=>{});throw new FlowAsyncValueError();}
  }
}

function* evaluateFlowCore(
  cells: FlowCell[],
  ctx: FlowExecutionContext,
  runNested: (gen: FlowGen<unknown>) => unknown,
): FlowGen<FlowEvaluationResult> {
  const scope: Record<string, unknown> = { ...(ctx.scope ?? {}) };
  if (ctx.workspaceRoot === undefined) {
    ctx.workspaceRoot = process.cwd();
  }
  const evalByRef = new Map<string, FlowCellEvaluation>();
  let lastQuery: unknown;

  const grid = buildFlowGrid(cells);
  ensureDbHandles(scope, ctx);

  // We use setNext() for deterministic row/col navigation. Stack logic is unused in
  // the executor (loops are handled explicitly), so pass an empty stack.
  const navStack: FlowStackFrame[] = [];

  type ControlSignal =
    | { type: "break"; from: string; target?: string }
    | { type: "continue"; from: string; target?: string }
    | { type: "goto"; from: string; target: FlowLocation }
    | { type: "return"; from: string; value: unknown }
    | { type: "result"; from: string; value: unknown }
    | { type: "end"; from: string; message?: string };

  type StepOutcome =
    | { kind: "next"; next: FlowLocation | null }
    | { kind: "jump"; from: string; target: FlowLocation }
    | { kind: "signal"; signal: ControlSignal };

  class FlowControlError extends Error {
    readonly signal: ControlSignal;

    constructor(signal: ControlSignal) {
      super(signal.type);
      this.name = "FlowControlError";
      this.signal = signal;
    }
  }

  const funcFrames: Array<{ lastValue: unknown }> = [];

  function* funcBody(masterCell: unknown, args: unknown[]): FlowGen<unknown> {
    if (typeof masterCell !== "string" || masterCell.trim().length === 0) {
      throw new Error("func() expects a master cellRef as the first argument");
    }

    const parsed = parseCellRef(masterCell);
    const master = grid.getCellByRef(parsed.cellRef);
    if (master.kind !== "command" || master.command?.kind !== "func") {
      throw new Error(`func() master cell must be a func command cell: ${parsed.cellRef}`);
    }

    // Assign args into cells starting at the master cell and moving right (A1,B1,C1,...).
    for (let i = 0; i < args.length; i++) {
      const ref = `${indexToCol(master.colIndex + i)}${master.row}`;
      scope[ref] = args[i];
    }

    const frame = { lastValue: null as unknown };
    funcFrames.push(frame);
    try {
      const blockEndRow = getCodeBlockEndRow(grid, master.row, master.colIndex);
      const signal = yield* runBlock({ row: master.row, colIndex: master.colIndex + 1 }, blockEndRow, master.colIndex);
      if (!signal) {
        return frame.lastValue ?? null;
      }

      if (signal.type === "return") {
        return signal.value;
      }

      if (signal.type === "goto") {
        const targetRef = `${indexToCol(signal.target.colIndex)}${signal.target.row}`;
        throw new Error(`Illegal goto out of func body: ${signal.from} -> ${targetRef}`);
      }

      if (signal.type === "break" || signal.type === "continue") {
        const origin = grid.getCellByRef(signal.from);
        recordError(origin.cellRef, origin.row, origin.col, origin.raw ?? "", `${signal.type} used outside loop`);
        throw new Error(`${signal.type} used outside loop`);
      }

      // result/end terminate the overall flow even when triggered inside func().
      throw new FlowControlError(signal);
    } finally {
      funcFrames.pop();
    }
  }

  // 表达式求值器同步调用 funcFn：异步驱动下返回 Promise（由 evalExpression
  // 的 Promise 分支 yield/await），同步驱动下直接返回值。
  const funcFn = (masterCell?: unknown, ...args: unknown[]): unknown =>
    runNested(funcBody(masterCell, args));

  const expressionRegistry = new FunctionRegistryBuilder(resolveExpressionFunctions(ctx)).add("func", funcFn).build();

  const loopSeq = new Map<string, number>();
  const loopSeqVarName = (cellRef: string) => `__loopSeq_${cellRef}`;

  const recordOk = (cellRef: string, row: number, col: string, rawExpr: string, result?: unknown) => {
    const evaluation: FlowCellEvaluation = {
      row,
      col,
      expr: rawExpr,
      status: "ok",
    };
    if (result !== undefined) {
      evaluation.result = result;
    }
    evalByRef.set(cellRef, evaluation);
  };

  const recordError = (cellRef: string, row: number, col: string, rawExpr: string, message: string) => {
    evalByRef.set(cellRef, {
      row,
      col,
      expr: rawExpr,
      status: "error",
      error: message,
    });
  };

  const nextFrom = (loc: FlowLocation): FlowLocation | null => setNext(grid, loc, false, navStack);
  const nextAfter = (loc: FlowLocation): FlowLocation | null => nextFrom({ row: loc.row, colIndex: loc.colIndex + 1 });

  const rewriteLoopSeqRefs = (input: string): { rewritten: string; refs: string[] } => {
    let out = "";
    const refs: string[] = [];
    let i = 0;
    let inSingle = false;
    let inDouble = false;

    while (i < input.length) {
      const ch = input[i];

      if (inSingle) {
        out += ch;
        if (ch === "\\" && i + 1 < input.length) {
          out += input[i + 1];
          i += 2;
          continue;
        }
        if (ch === "'") inSingle = false;
        i += 1;
        continue;
      }

      if (inDouble) {
        out += ch;
        if (ch === "\\" && i + 1 < input.length) {
          out += input[i + 1];
          i += 2;
          continue;
        }
        if (ch === '"') inDouble = false;
        i += 1;
        continue;
      }

      if (ch === "'") {
        inSingle = true;
        out += ch;
        i += 1;
        continue;
      }
      if (ch === '"') {
        inDouble = true;
        out += ch;
        i += 1;
        continue;
      }

      if (ch === "#") {
        const tail = input.slice(i + 1);
        const match = tail.match(/^([A-Za-z]+\d+)/);
        if (match) {
          const cellRef = match[1].toUpperCase();
          refs.push(cellRef);
          out += loopSeqVarName(cellRef);
          i += 1 + match[1].length;
          continue;
        }
      }

      out += ch;
      i += 1;
    }

    return { rewritten: out, refs };
  };

  function* evalExpression(expression: string): FlowGen<unknown> {
    if(ctx.signal?.aborted)throw ctx.signal.reason ?? new Error("Flow cancelled");
    const { rewritten, refs } = rewriteLoopSeqRefs(expression);
    for (const ref of refs) {
      const seq = loopSeq.get(ref);
      if (seq === undefined) {
        throw new Error(`Unknown loop sequence reference: #${ref}`);
      }
      scope[loopSeqVarName(ref)] = seq;
    }

    const connectionName = inferConnectionName(rewritten);
    const hasConnection = Boolean(connectionName && ctx.connections?.has(connectionName));
    const hasDataSource = Boolean(connectionName && ctx.dataSourceConfigs?.some((config) => config.name === connectionName));

    if (connectionName && !scope[connectionName] && hasConnection) {
      const connection = resolveConnection(connectionName, ctx);
      scope[connectionName] = createDbHandle(connection, ctx);
    }

    if (connectionName && !scope[connectionName] && hasDataSource && ctx.dataSourceConfigs) {
      const dataSource=ctx.resources!.registry.get(connectionName);
      if(dataSource)scope[connectionName]=managedDataSourceHandle(dataSource,ctx);
    }

    if (connectionName && !scope[connectionName] && !hasConnection && !hasDataSource) {
      throw new Error(`Connection '${connectionName}' not found`);
    }

    const qValue = resolveQQuery(rewritten, ctx, scope);
    const registry = expressionRegistry;
    const compiled = qValue === null ? compileExpression(rewritten, registry, defaultMemberRegistry) : null;
    let value = qValue === null ? compiled!.evaluate(scope) : qValue;
    if (value instanceof Promise) {
      // 唯一的真异步点：异步驱动 await；同步驱动在此处终止并抛错。
      value = yield value;
    }
    if(value instanceof Cursor && !Object.values(ctx.scope ?? {}).includes(value))ctx.resources!.own(value,"expression cursor");
    if(ctx.signal?.aborted)throw ctx.signal.reason ?? new Error("Flow cancelled");
    return value;
  }

  function* executeExpressionCell(cellRef: string): FlowGen<void> {
    const cell = grid.getCellByRef(cellRef);
    const rawExpr = cell.raw ?? "";
    const expression = (cell.normalizedExpr ?? "").trim();
    if (expression.length === 0) {
      recordError(cell.cellRef, cell.row, cell.col, rawExpr, "Empty expression");
      return;
    }
    try {
      const value = yield* evalExpression(expression);
      if (!cell.executeOnly) {
        scope[cell.cellRef] = value;
      }

      const queryResult = toQueryResult(value);
      if (queryResult) {
        lastQuery = queryResult;
      }

      recordOk(cell.cellRef, cell.row, cell.col, rawExpr, value);

      if (funcFrames.length > 0) {
        funcFrames[funcFrames.length - 1].lastValue = value;
      }
    } catch (error) {
      if (error instanceof FlowControlError || error instanceof FlowAsyncValueError) {
        throw error;
      }
      const message = error instanceof Error ? error.message : String(error);
      recordError(cell.cellRef, cell.row, cell.col, rawExpr, message);
    }
  }

  const parseBreakContinueTarget = (cellRef: string, raw: string): { target?: string; error?: string } => {
    const trimmed = raw.trim();
    if (trimmed.length === 0) return {};
    try {
      const parsed = parseCellRef(trimmed);
      return { target: parsed.cellRef };
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      return { error: `Invalid target cellRef '${trimmed}' for ${cellRef}: ${message}` };
    }
  };

  const splitTopLevelCommas = (input: string): string[] => {
    const parts: string[] = [];
    let buf = "";
    let depthParen = 0;
    let depthBracket = 0;
    let depthBrace = 0;
    let inSingle = false;
    let inDouble = false;

    const flush = () => {
      const v = buf.trim();
      parts.push(v);
      buf = "";
    };

    for (let i = 0; i < input.length; i++) {
      const ch = input[i];

      if (inSingle) {
        buf += ch;
        if (ch === "\\" && i + 1 < input.length) {
          buf += input[i + 1];
          i += 1;
          continue;
        }
        if (ch === "'") inSingle = false;
        continue;
      }

      if (inDouble) {
        buf += ch;
        if (ch === "\\" && i + 1 < input.length) {
          buf += input[i + 1];
          i += 1;
          continue;
        }
        if (ch === '"') inDouble = false;
        continue;
      }

      if (ch === "'") {
        inSingle = true;
        buf += ch;
        continue;
      }
      if (ch === '"') {
        inDouble = true;
        buf += ch;
        continue;
      }

      if (ch === "(") depthParen += 1;
      else if (ch === ")") depthParen = Math.max(0, depthParen - 1);
      else if (ch === "[") depthBracket += 1;
      else if (ch === "]") depthBracket = Math.max(0, depthBracket - 1);
      else if (ch === "{") depthBrace += 1;
      else if (ch === "}") depthBrace = Math.max(0, depthBrace - 1);

      if (ch === "," && depthParen === 0 && depthBracket === 0 && depthBrace === 0) {
        flush();
        continue;
      }

      buf += ch;
    }

    flush();
    return parts;
  };

  const asInteger = (value: unknown, label: string): number => {
    if (typeof value !== "number" || !Number.isFinite(value)) {
      throw new Error(`${label} must be a finite number`);
    }
    if (!Number.isInteger(value)) {
      throw new Error(`${label} must be an integer`);
    }
    return value;
  };

  function* runBlock(start: FlowLocation, endRow: number, indentColIndex: number): FlowGen<ControlSignal | null> {
    let cur = nextFrom(start);
    while (cur) {
      if (cur.row > endRow) return null;
      if (cur.colIndex <= indentColIndex) return null;

      const cell = grid.getCell(cur.row, cur.colIndex);
      let outcome: StepOutcome;
      try {
        outcome = yield* executeAt(cur, cell);
      } catch (error) {
        if (error instanceof FlowControlError) {
          return error.signal;
        }
        throw error;
      }
      if (outcome.kind === "signal") {
        return outcome.signal;
      }
      if (outcome.kind === "jump") {
        // If the jump escapes the current block boundary, bubble it up as a goto signal.
        if (outcome.target.row > endRow || outcome.target.colIndex <= indentColIndex) {
          return { type: "goto", from: outcome.from, target: outcome.target };
        }
        cur = outcome.target;
        continue;
      }
      cur = outcome.next;
    }
    return null;
  }

  function* executeIfCommand(ifCell: ReturnType<typeof grid.getCell>): FlowGen<StepOutcome> {
    const indentColIndex = ifCell.colIndex;

    function* evalCond(cell: ReturnType<typeof grid.getCell>): FlowGen<boolean> {
      const condExpr = cell.command?.rawArgs ?? "";
      if (condExpr.trim().length === 0) {
        recordError(cell.cellRef, cell.row, cell.col, cell.raw ?? "", "if/elseif requires a condition expression");
        return false;
      }
      try {
        const value = yield* evalExpression(condExpr);
        scope[cell.cellRef] = value;
        recordOk(cell.cellRef, cell.row, cell.col, cell.raw ?? "", value);
        return truthy(value);
      } catch (error) {
        if (error instanceof FlowAsyncValueError) {
          throw error;
        }
        const message = error instanceof Error ? error.message : String(error);
        recordError(cell.cellRef, cell.row, cell.col, cell.raw ?? "", message);
        return false;
      }
    }

    // Row-unique dialect: branches are represented on later rows (no same-row chains).
    const branches: Array<{ cmd: ReturnType<typeof grid.getCell>; endRow: number }> = [];
    const ifEndRow = getCodeBlockEndRow(grid, ifCell.row, indentColIndex);
    branches.push({ cmd: ifCell, endRow: ifEndRow });

    let scanRow = ifEndRow + 1;
    while (scanRow <= grid.maxRow) {
      const nextCell = grid.getCell(scanRow, indentColIndex);
      if (nextCell.kind === "blank" || nextCell.kind === "comment") {
        scanRow += 1;
        continue;
      }
      if (nextCell.kind === "command" && (nextCell.command?.kind === "elseif" || nextCell.command?.kind === "else")) {
        const endRow = getCodeBlockEndRow(grid, nextCell.row, indentColIndex);
        branches.push({ cmd: nextCell, endRow });
        scanRow = endRow + 1;
        continue;
      }
      break;
    }

    const chainEndRow = branches[branches.length - 1].endRow;
    function* execBody(cmdRow: number, endRow: number): FlowGen<ControlSignal | null> {
      return yield* runBlock({ row: cmdRow, colIndex: indentColIndex + 1 }, endRow, indentColIndex);
    }

    if (yield* evalCond(ifCell)) {
      const signal = yield* execBody(ifCell.row, ifEndRow);
      if (signal) return { kind: "signal", signal };
      return { kind: "next", next: nextFrom({ row: chainEndRow + 1, colIndex: 1 }) };
    }

    for (const branch of branches.slice(1)) {
      const kind = branch.cmd.command?.kind;
      if (kind === "elseif") {
        if (yield* evalCond(branch.cmd)) {
          const signal = yield* execBody(branch.cmd.row, branch.endRow);
          if (signal) return { kind: "signal", signal };
          return { kind: "next", next: nextFrom({ row: chainEndRow + 1, colIndex: 1 }) };
        }
        continue;
      }
      if (kind === "else") {
        scope[branch.cmd.cellRef] = null;
        recordOk(branch.cmd.cellRef, branch.cmd.row, branch.cmd.col, branch.cmd.raw ?? "", null);
        const signal = yield* execBody(branch.cmd.row, branch.endRow);
        if (signal) return { kind: "signal", signal };
        return { kind: "next", next: nextFrom({ row: chainEndRow + 1, colIndex: 1 }) };
      }
    }

    return { kind: "next", next: nextFrom({ row: chainEndRow + 1, colIndex: 1 }) };
  }

  function* executeForCommand(forCell: ReturnType<typeof grid.getCell>): FlowGen<StepOutcome> {
    const rawExpr = forCell.raw ?? "";
    const args = (forCell.command?.rawArgs ?? "").trim();
    const loopRef = forCell.cellRef;
    const indentColIndex = forCell.colIndex;
    const blockEndRow = getCodeBlockEndRow(grid, forCell.row, indentColIndex);

    // Determine loop variant.
    type LoopKind =
      | { kind: "infinite" }
      | { kind: "count"; n: number }
      | { kind: "range"; start: number; end: number; step: number }
      | { kind: "sequence"; values: unknown[] }
      | { kind: "while"; condExpr: string };

    let loop: LoopKind;
    try {
      if (args.length === 0) {
        loop = { kind: "infinite" };
      } else {
        const parts = splitTopLevelCommas(args).filter((p) => p.length > 0);
        if (parts.length >= 2) {
          if (parts.length > 3) {
            throw new Error("for range expects 2 or 3 arguments");
          }
          const start = asInteger(yield* evalExpression(parts[0]), "for start");
          const end = asInteger(yield* evalExpression(parts[1]), "for end");
          const step = parts.length === 3 ? asInteger(yield* evalExpression(parts[2]), "for step") : 1;
          if (step === 0) {
            throw new Error("for step must not be 0");
          }
          loop = { kind: "range", start, end, step };
        } else {
          const value = yield* evalExpression(args);
          if (Array.isArray(value)) {
            loop = { kind: "sequence", values: value };
          } else if (value instanceof DataSet) {
            loop = { kind: "sequence", values: (value as unknown as { rows: unknown[] }).rows ?? [] };
          } else if (isDataSetLike(value)) {
            loop = { kind: "sequence", values: (value.rows ?? []) as unknown[] };
          } else if (typeof value === "number" && Number.isFinite(value) && Number.isInteger(value)) {
            loop = { kind: "count", n: value };
          } else if (typeof value === "boolean") {
            loop = { kind: "while", condExpr: args };
          } else {
            throw new Error("Invalid for loop argument");
          }
        }
      }
    } catch (e) {
      if (e instanceof FlowAsyncValueError) {
        throw e;
      }
      const message = e instanceof Error ? e.message : String(e);
      recordError(loopRef, forCell.row, forCell.col, rawExpr, message);
      return { kind: "next", next: nextAfter({ row: forCell.row, colIndex: forCell.colIndex }) };
    }

    function* runBody(): FlowGen<ControlSignal | null> {
      return yield* runBlock({ row: forCell.row, colIndex: indentColIndex + 1 }, blockEndRow, indentColIndex);
    }

    let seq = 0;
    let rangeCur = loop.kind === "range" ? loop.start : 0;
    let seqIdx = 0;

    function* hasNext(): FlowGen<{ done: boolean; value?: unknown }> {
      if (loop.kind === "infinite") {
        return { done: false, value: seq + 1 };
      }
      if (loop.kind === "count") {
        if (seq >= loop.n) return { done: true };
        return { done: false, value: seq + 1 };
      }
      if (loop.kind === "range") {
        if (loop.step > 0 && rangeCur > loop.end) return { done: true };
        if (loop.step < 0 && rangeCur < loop.end) return { done: true };
        return { done: false, value: rangeCur };
      }
      if (loop.kind === "sequence") {
        if (seqIdx >= loop.values.length) return { done: true };
        return { done: false, value: loop.values[seqIdx] };
      }
      // while
      const condValue = yield* evalExpression(loop.condExpr);
      if (!truthy(condValue)) return { done: true };
      return { done: false, value: condValue };
    }

    while (true) {
      const next = yield* hasNext();
      if (next.done) break;

      seq += 1;
      loopSeq.set(loopRef, seq);
      scope[loopRef] = next.value;
      recordOk(loopRef, forCell.row, forCell.col, rawExpr, next.value);

      const signal = yield* runBody();
      if (signal) {
        if (signal.type === "continue") {
          if (!signal.target || signal.target === loopRef) {
            // continue current loop
          } else {
            loopSeq.delete(loopRef);
            return { kind: "signal", signal };
          }
        } else if (signal.type === "break") {
          if (!signal.target || signal.target === loopRef) {
            break;
          }
          loopSeq.delete(loopRef);
          return { kind: "signal", signal };
        } else {
          loopSeq.delete(loopRef);
          return { kind: "signal", signal };
        }
      }

      if (loop.kind === "range") {
        rangeCur += loop.step;
      } else if (loop.kind === "sequence") {
        seqIdx += 1;
      }
    }

    loopSeq.delete(loopRef);
    return { kind: "next", next: nextFrom({ row: blockEndRow + 1, colIndex: 1 }) };
  }

  function executeGotoCommand(gotoCell: ReturnType<typeof grid.getCell>, loc: FlowLocation): StepOutcome {
    const rawExpr = gotoCell.raw ?? "";
    const args = (gotoCell.command?.rawArgs ?? "").trim();
    if (args.length === 0) {
      recordError(gotoCell.cellRef, gotoCell.row, gotoCell.col, rawExpr, "goto requires a target cellRef");
      return { kind: "next", next: nextAfter(loc) };
    }

    let parsed: ReturnType<typeof parseCellRef>;
    try {
      parsed = parseCellRef(args);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      recordError(gotoCell.cellRef, gotoCell.row, gotoCell.col, rawExpr, `Invalid goto target '${args}': ${message}`);
      return { kind: "next", next: nextAfter(loc) };
    }

    // Safety: never allow jumping into a deeper indentation scope.
    if (parsed.colIndex > gotoCell.colIndex) {
      recordError(
        gotoCell.cellRef,
        gotoCell.row,
        gotoCell.col,
        rawExpr,
        `Illegal goto into deeper indentation: ${gotoCell.cellRef} -> ${parsed.cellRef}`,
      );
      return { kind: "next", next: nextAfter(loc) };
    }

    const targetCell = grid.getCell(parsed.row, parsed.colIndex);
    if (targetCell.kind === "blank" || targetCell.kind === "comment") {
      recordError(
        gotoCell.cellRef,
        gotoCell.row,
        gotoCell.col,
        rawExpr,
        `Invalid goto target '${parsed.cellRef}': target cell is ${targetCell.kind}`,
      );
      return { kind: "next", next: nextAfter(loc) };
    }

    scope[gotoCell.cellRef] = null;
    recordOk(gotoCell.cellRef, gotoCell.row, gotoCell.col, rawExpr, null);
    return { kind: "jump", from: gotoCell.cellRef, target: { row: parsed.row, colIndex: parsed.colIndex } };
  }

  function* executeTryCommand(tryCell: ReturnType<typeof grid.getCell>): FlowGen<StepOutcome> {
    const rawExpr = tryCell.raw ?? "";
    const indentColIndex = tryCell.colIndex;
    const blockEndRow = getCodeBlockEndRow(grid, tryCell.row, indentColIndex);
    const nextAfterBlock = nextFrom({ row: blockEndRow + 1, colIndex: 1 });

    // Walk the try block and stop on the first recorded error.
    let cur = nextFrom({ row: tryCell.row, colIndex: indentColIndex + 1 });
    while (cur) {
      if (cur.row > blockEndRow) break;
      if (cur.colIndex <= indentColIndex) break;

      const cell = grid.getCell(cur.row, cur.colIndex);

      // Expression errors are normally recorded as error cells. Inside a try block,
      // treat them as caught: store the message in the try cell and keep overall
      // execution OK.
      if (cell.kind === "expression") {
        const expression = (cell.normalizedExpr ?? "").trim();
        if (expression.length === 0) {
          scope[tryCell.cellRef] = "Empty expression";
          recordOk(tryCell.cellRef, tryCell.row, tryCell.col, rawExpr, "Empty expression");
          return { kind: "next", next: nextAfterBlock };
        }
        try {
          const value = yield* evalExpression(expression);
          if (!cell.executeOnly) {
            scope[cell.cellRef] = value;
          }

          const queryResult = toQueryResult(value);
          if (queryResult) {
            lastQuery = queryResult;
          }

          recordOk(cell.cellRef, cell.row, cell.col, cell.raw ?? "", value);
          if (funcFrames.length > 0) {
            funcFrames[funcFrames.length - 1].lastValue = value;
          }
        } catch (error) {
          if (error instanceof FlowControlError) {
            return { kind: "signal", signal: error.signal };
          }
          if (error instanceof FlowAsyncValueError) {
            throw error;
          }
          const message = error instanceof Error ? error.message : String(error);
          scope[tryCell.cellRef] = message;
          recordOk(tryCell.cellRef, tryCell.row, tryCell.col, rawExpr, message);
          return { kind: "next", next: nextAfterBlock };
        }

        cur = nextAfter(cur);
        continue;
      }

      let outcome: StepOutcome;
      try {
        outcome = yield* executeAt(cur, cell);
      } catch (error) {
        if (error instanceof FlowControlError) {
          return { kind: "signal", signal: error.signal };
        }
        if (error instanceof FlowAsyncValueError) {
          throw error;
        }
        // Treat unexpected runtime errors as caught by try.
        const message = error instanceof Error ? error.message : String(error);
        scope[tryCell.cellRef] = message;
        recordOk(tryCell.cellRef, tryCell.row, tryCell.col, rawExpr, message);
        return { kind: "next", next: nextAfterBlock };
      }

      if (outcome.kind === "signal") {
        return outcome;
      }

      if (outcome.kind === "jump") {
        if (outcome.target.row > blockEndRow || outcome.target.colIndex <= indentColIndex) {
          return { kind: "signal", signal: { type: "goto", from: outcome.from, target: outcome.target } };
        }
        cur = outcome.target;
      } else {
        cur = outcome.next;
      }

      const evaluation = evalByRef.get(cell.cellRef);
      if (evaluation?.status === "error") {
        const message = evaluation.error ?? "";
        // Error is caught by try; do not surface it as a failing cell.
        evalByRef.delete(cell.cellRef);
        scope[tryCell.cellRef] = message;
        recordOk(tryCell.cellRef, tryCell.row, tryCell.col, rawExpr, message);
        return { kind: "next", next: nextAfterBlock };
      }
    }

    scope[tryCell.cellRef] = null;
    recordOk(tryCell.cellRef, tryCell.row, tryCell.col, rawExpr, null);
    return { kind: "next", next: nextAfterBlock };
  }

  function* executeAt(loc: FlowLocation, cell: ReturnType<typeof grid.getCell>): FlowGen<StepOutcome> {
    if (cell.kind === "expression") {
      yield* executeExpressionCell(cell.cellRef);
      return { kind: "next", next: nextAfter(loc) };
    }

    if (cell.kind === "command") {
      const kind = cell.command?.kind ?? "unknown";
      const rawExpr = cell.raw ?? "";

      if (kind === "if") {
        return yield* executeIfCommand(cell);
      }
      if (kind === "for") {
        return yield* executeForCommand(cell);
      }
      if (kind === "goto") {
        return executeGotoCommand(cell, loc);
      }
      if (kind === "try") {
        return yield* executeTryCommand(cell);
      }
      if (kind === "func") {
        // Subroutine definition: skip its body during normal flow execution.
        scope[cell.cellRef] = null;
        recordOk(cell.cellRef, cell.row, cell.col, rawExpr, null);
        const blockEndRow = getCodeBlockEndRow(grid, cell.row, cell.colIndex);
        return { kind: "next", next: nextFrom({ row: blockEndRow + 1, colIndex: 1 }) };
      }
      if (kind === "return") {
        const expr = (cell.command?.rawArgs ?? "").trim();
        try {
          const value = expr.length === 0 ? null : yield* evalExpression(expr);
          scope[cell.cellRef] = value;
          recordOk(cell.cellRef, cell.row, cell.col, rawExpr, value);
          return { kind: "signal", signal: { type: "return", from: cell.cellRef, value } };
        } catch (e) {
          if (e instanceof FlowAsyncValueError) {
            throw e;
          }
          const message = e instanceof Error ? e.message : String(e);
          recordError(cell.cellRef, cell.row, cell.col, rawExpr, message);
          return { kind: "next", next: nextAfter(loc) };
        }
      }
      if (kind === "result") {
        const expr = (cell.command?.rawArgs ?? "").trim();
        if (expr.length === 0) {
          recordError(cell.cellRef, cell.row, cell.col, rawExpr, "result requires an expression");
          return { kind: "next", next: nextAfter(loc) };
        }
        try {
          const value = yield* evalExpression(expr);
          scope[cell.cellRef] = value;
          recordOk(cell.cellRef, cell.row, cell.col, rawExpr, value);
          return { kind: "signal", signal: { type: "result", from: cell.cellRef, value } };
        } catch (e) {
          if (e instanceof FlowAsyncValueError) {
            throw e;
          }
          const message = e instanceof Error ? e.message : String(e);
          recordError(cell.cellRef, cell.row, cell.col, rawExpr, message);
          return { kind: "next", next: nextAfter(loc) };
        }
      }
      if (kind === "end") {
        const args = (cell.command?.rawArgs ?? "").trim();
        if (args.length === 0) {
          scope[cell.cellRef] = null;
          recordOk(cell.cellRef, cell.row, cell.col, rawExpr, null);
          return { kind: "signal", signal: { type: "end", from: cell.cellRef } };
        }

        try {
          const value = yield* evalExpression(args);
          const message = value === null || value === undefined ? "" : String(value);
          scope[cell.cellRef] = message;
          recordOk(cell.cellRef, cell.row, cell.col, rawExpr, message);
          return { kind: "signal", signal: { type: "end", from: cell.cellRef, message } };
        } catch (e) {
          if (e instanceof FlowAsyncValueError) {
            throw e;
          }
          const message = e instanceof Error ? e.message : String(e);
          recordError(cell.cellRef, cell.row, cell.col, rawExpr, message);
          return { kind: "next", next: nextAfter(loc) };
        }
      }
      if (kind === "break" || kind === "continue") {
        const parsed = parseBreakContinueTarget(cell.cellRef, cell.command?.rawArgs ?? "");
        if (parsed.error) {
          recordError(cell.cellRef, cell.row, cell.col, rawExpr, parsed.error);
          return { kind: "next", next: nextAfter(loc) };
        }
        scope[cell.cellRef] = null;
        recordOk(cell.cellRef, cell.row, cell.col, rawExpr, null);
        return {
          kind: "signal",
          signal: {
            type: kind,
            from: cell.cellRef,
            target: parsed.target,
          },
        };
      }

      recordError(cell.cellRef, cell.row, cell.col, rawExpr, `Unsupported command cell: ${kind}`);
      return { kind: "next", next: nextAfter(loc) };
    }

    // Defensive: setNext should skip blank/comment.
    return { kind: "next", next: nextAfter(loc) };
  }

  let start = { row: 1, colIndex: 1 };
  let terminalSignal: ControlSignal | null = null;
  while (true) {
    const signal = yield* runBlock(start, grid.maxRow, 0);
    if (!signal) break;

    if (signal.type === "goto") {
      start = signal.target;
      continue;
    }

    terminalSignal = signal;
    break;
  }

  if (terminalSignal && (terminalSignal.type === "break" || terminalSignal.type === "continue")) {
    const origin = grid.getCellByRef(terminalSignal.from);
    recordError(origin.cellRef, origin.row, origin.col, origin.raw ?? "", `${terminalSignal.type} used outside loop`);
  }

  if (terminalSignal && terminalSignal.type === "return") {
    const origin = grid.getCellByRef(terminalSignal.from);
    recordError(origin.cellRef, origin.row, origin.col, origin.raw ?? "", "return used outside func");
  }

  let result: unknown;
  if (terminalSignal?.type === "result") {
    result = terminalSignal.value;
  }

  if (terminalSignal?.type === "end" && terminalSignal.message !== undefined) {
    throw new Error(terminalSignal.message);
  }

  const evaluations: FlowCellEvaluation[] = grid.cells.map((cell) => {
    const existing = evalByRef.get(cell.cellRef);
    if (existing) return existing;

    if (cell.kind === "blank" || cell.kind === "comment") {
      return { row: cell.row, col: cell.col, expr: cell.raw ?? "", status: "ok" };
    }
    // Skipped cells (e.g., non-taken branches) are considered OK but produce no value.
    return { row: cell.row, col: cell.col, expr: cell.raw ?? "", status: "ok" };
  });

  return { cells: evaluations, lastQuery, result, scope };
}

function isQueryResult(value: unknown): value is QueryResultData {
  return Boolean(
    value &&
      typeof value === "object" &&
      "columns" in (value as Record<string, unknown>) &&
      "rows" in (value as Record<string, unknown>) &&
      Array.isArray((value as { columns?: unknown[] }).columns) &&
      Array.isArray((value as { rows?: unknown[] }).rows) &&
      ((value as { rows?: unknown[] }).rows ?? []).every((row) => row && typeof row === "object" && !Array.isArray(row))
  );
}

function isDataSetLike(value: unknown): value is DataSetLike {
  return Boolean(
    value &&
      typeof value === "object" &&
      "rows" in (value as Record<string, unknown>) &&
      Array.isArray((value as { rows?: unknown[] }).rows)
  );
}

function toQueryResult(value: unknown): QueryResultData | null {
  if (isQueryResult(value)) return value;
  if (value instanceof DataSet) {
    const ds = value as unknown as { schema: { name: string }[]; rows: Record<string, unknown>[] };
    return {
      columns: ds.schema.map((col: { name: string }) => col.name),
      rows: ds.rows,
    };
  }
  if (Array.isArray(value)) {
    const rows = value.filter((row): row is Record<string, unknown> => Boolean(row && typeof row === "object" && !Array.isArray(row)));
    if (rows.length === 0) return null;
    return { columns: Object.keys(rows[0]), rows };
  }
  if (isDataSetLike(value)) {
    const rows = (value.rows ?? []).filter((row): row is Record<string, unknown> => Boolean(row && typeof row === "object" && !Array.isArray(row)));
    if (rows.length === 0) return null;
    const columns = value.schema?.length
      ? value.schema.map((col) => col.name)
      : Object.keys(rows[0]);
    return { columns, rows };
  }
  return null;
}

const scopeCloser=Symbol("flowScope.close");
export function buildFlowScope(ctx: FlowExecutionContext): Record<string, unknown> {
  const resources=new FlowResources(ctx.observeResource);
  const runtime={...ctx,resources,executionMode:"async" as const};
  const scope: Record<string,unknown>={};
  try {
    for(const config of ctx.dataSourceConfigs ?? [])resources.registry.register(config);
    ensureDbHandles(scope,runtime);
    Object.defineProperty(scope,scopeCloser,{value:()=>resources.close()});
    return scope;
  } catch(error) {const cleanup=resources.close();if(cleanup instanceof Promise)void cleanup.catch(()=>{});throw error;}
}
export async function closeFlowScope(scope: Record<string,unknown>): Promise<void> {
  const close=(scope as Record<symbol,unknown>)[scopeCloser];
  if(typeof close==="function")await close();
}
function managedDataSourceHandle(dataSource: import("./datasource/types").DataSource,ctx:FlowExecutionContext) {
  return createDataSourceHandle(dataSource,{allowAsync:ctx.executionMode!=="sync",own:cursor=>ctx.resources!.own(cursor,dataSource.name)});
}

export type { DataSourceConfig, SqliteConfig, CsvConfig, JsonConfig } from "./datasource/types";
export { ConnectionRegistry } from "./connection/registry";
export { createDataSourceHandle } from "./connection/handle";

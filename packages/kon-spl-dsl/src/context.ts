import { parseJsonPreservingNumbers, stringifySplJson } from "depa-data-expression";
import { parseCsvTable, tableFromRecords, queryTableSqlite } from "depa-data-spl-flow";
/**
 * SplContext — kon-spl-dsl 的运行时载体（纯数据 + 少量工厂）。
 *
 * - `createSplContext(config)`：数据源注册表（name → SyncDataSource）、
 *   scope、workspaceRoot（默认 process.cwd()）。
 * - `SyncDataSource`：全同步数据源接口（kunun 解释器同步 dispatch，
 *   Promise 结果会丢失 → 不能走 async 路径，见 track findings）。
 * - sqlite 用 bun:sqlite 直连（depa-data-sqlite-adapter 的 SQLiteAdapter
 *   无 DML changes 通道，query/execute 需共享同一连接，故本地直连）。
 * - csv/json：同步外观复用spl-flow公开的解析与queryTableSqlite适配器，
 *   与async facade保持相同类型/列策略，临时SQLite在finally释放。
 * - `resolveWorkspacePath(input, root)`：本地实现，语义与 spl-flow 的
 *   resolveWorkspacePath 一致（相对路径基于 root；越界抛
 *   "Path escapes workspace root"）；不 import 其私有函数。
 */
import { Database, type SQLQueryBindings } from "bun:sqlite";
import { readFileSync } from "node:fs";
import { isAbsolute, resolve as resolvePath, sep } from "node:path";
import { DataSet, type ColumnSchema, type Row } from "depa-data-core";

// ---------------------------------------------------------------------------
// 类型
// ---------------------------------------------------------------------------

/** 全同步数据源。query 无 sql 时表示全量读取（文件型数据源）。 */
export interface SyncDataSource {
  type: "sqlite" | "csv" | "json";
  name: string;
  query(sql?: string, params?: unknown[]): DataSet;
  execute?(sql: string, params?: unknown[]): { changes: number };
  close?(): void;
}

export interface SplContextConfig {
  /** 文件路径沙箱根；默认 process.cwd() */
  workspaceRoot?: string;
  /** spl_eval 的初始 scope */
  scope?: Record<string, unknown>;
}

/** 纯数据载体：注册表 + scope + 沙箱根。业务逻辑在工厂与 word 展开器中。 */
export interface SplContext {
  workspaceRoot: string;
  scope: Record<string, unknown>;
  dataSources: Map<string, SyncDataSource>;
}

export type SplDataSourceConfig =
  | { type: "sqlite"; name: string; path: string }
  | {
      type: "csv";
      name: string;
      path: string;
      delimiter?: string;
      hasHeader?: boolean;
      encoding?: BufferEncoding;
    }
  | { type: "json"; name: string; path: string; encoding?: BufferEncoding };

// ---------------------------------------------------------------------------
// 工厂
// ---------------------------------------------------------------------------

export function createSplContext(config: SplContextConfig = {}): SplContext {
  return {
    workspaceRoot: config.workspaceRoot ?? process.cwd(),
    scope: config.scope ?? {},
    dataSources: new Map<string, SyncDataSource>(),
  };
}

/**
 * 路径沙箱解析（语义与 depa-data-spl-flow 内部 resolveWorkspacePath 一致）：
 * 相对路径基于 root；解析结果越出 root 抛错。
 */
export function resolveWorkspacePath(input: string, root: string): string {
  const rootResolved = resolvePath(root);
  const resolved = isAbsolute(input)
    ? resolvePath(input)
    : resolvePath(rootResolved, input);
  const rootPrefix = rootResolved.endsWith(sep) ? rootResolved : rootResolved + sep;
  if (resolved !== rootResolved && !resolved.startsWith(rootPrefix)) {
    throw new Error("Path escapes workspace root");
  }
  return resolved;
}

/**
 * 打开一个同步数据源并注册进 ctx.dataSources（name 唯一，重复注册抛错）。
 * 路径经 workspaceRoot 沙箱校验。
 */
export function openDataSource(
  ctx: SplContext,
  config: SplDataSourceConfig,
): SyncDataSource {
  if (ctx.dataSources.has(config.name)) {
    throw new Error(`Data source "${config.name}" already registered`);
  }
  const path = resolveWorkspacePath(config.path, ctx.workspaceRoot);
  let ds: SyncDataSource;
  switch (config.type) {
    case "sqlite":
      ds = createSqliteDataSource(config.name, path);
      break;
    case "csv":
      ds = createCsvDataSource(config.name, path, config);
      break;
    case "json":
      ds = createJsonDataSource(config.name, path, config);
      break;
    default:
      throw new Error(
        `Unsupported data source type: ${String((config as { type?: unknown }).type)}`,
      );
  }
  ctx.dataSources.set(config.name, ds);
  return ds;
}

// ---------------------------------------------------------------------------
// sqlite（bun:sqlite 直连，全同步）
// ---------------------------------------------------------------------------

function toBindings(params?: unknown[]): SQLQueryBindings[] {
  return (params ?? []) as SQLQueryBindings[];
}

function deriveSchema(rows: Row[], columnNames: string[]): ColumnSchema[] {
  if (rows.length === 0) {
    return columnNames.map((name) => ({ name, type: "unknown" }));
  }
  const names = columnNames.length > 0 ? columnNames : Object.keys(rows[0]);
  return names.map((name) => ({ name, type: typeof rows[0][name] }));
}

function createSqliteDataSource(name: string, path: string): SyncDataSource {
  let db: Database | null = new Database(path, { create: true, readwrite: true });
  const requireDb = (): Database => {
    if (!db) throw new Error(`Data source "${name}" is closed`);
    return db;
  };
  return {
    type: "sqlite",
    name,
    query(sql?: string, params?: unknown[]): DataSet {
      if (!sql) throw new Error("sqlite data source requires sql for query()");
      const stmt = requireDb().query<Record<string, unknown>, SQLQueryBindings[]>(sql);
      const rows = stmt.all(...toBindings(params)) as Row[];
      return new DataSet(deriveSchema(rows, stmt.columnNames), rows);
    },
    execute(sql: string, params?: unknown[]): { changes: number } {
      const result = requireDb().run(sql, toBindings(params));
      return { changes: typeof result.changes === "number" ? result.changes : 0 };
    },
    close(): void {
      db?.close();
      db = null;
    },
  };
}

// ---------------------------------------------------------------------------
// csv / json（同步读文件；无 sql 全量读取，带 sql 经临时内存 sqlite）
// ---------------------------------------------------------------------------

/** 与 spl-flow parseCsvContent 语义一致：trim、空行过滤、数值归一。 */
function parseCsv(content: string, delimiter: string, hasHeader: boolean): { columns: string[]; rows: Row[] } {
  return parseCsvTable(content, { delimiter, hasHeader });
}

function parseJsonRecords(content: string): { columns: string[]; rows: Row[] } {
  return tableFromRecords(parseJsonPreservingNumbers(content));
}

function toDataSet(data: { columns: string[]; rows: Row[] }): DataSet {
  return new DataSet(deriveSchema(data.rows, data.columns), data.rows);
}

/** 带 sql 时：把行灌进临时内存 sqlite 查询（表名与 spl-flow datasource 一致）。 */
function queryViaTempSqlite(
  data: { columns: string[]; rows: Row[] },
  tableName: string,
  sql: string,
  params?: unknown[],
): DataSet {
  const result = queryTableSqlite(data, tableName as "csv_data" | "json_data", sql, params);
  const rows = result.rows.map(values => Object.fromEntries(result.columns.map((name,index) => [name,values[index]])));
  return new DataSet(deriveSchema(rows, result.columns), rows);
}

function createFileDataSource(
  type: "csv" | "json",
  name: string,
  tableName: string,
  load: () => { columns: string[]; rows: Row[] },
): SyncDataSource {
  let cache: { columns: string[]; rows: Row[] } | null = null;
  const data = (): { columns: string[]; rows: Row[] } => (cache ??= load());
  return {
    type,
    name,
    query(sql?: string, params?: unknown[]): DataSet {
      if (!sql) return toDataSet(data());
      return queryViaTempSqlite(data(), tableName, sql, params);
    },
    close(): void {
      cache = null;
    },
  };
}

function createCsvDataSource(
  name: string,
  path: string,
  config: { delimiter?: string; hasHeader?: boolean; encoding?: BufferEncoding },
): SyncDataSource {
  return createFileDataSource("csv", name, "csv_data", () =>
    parseCsv(
      readFileSync(path, config.encoding ?? "utf-8"),
      config.delimiter ?? ",",
      config.hasHeader !== false,
    ),
  );
}

function createJsonDataSource(
  name: string,
  path: string,
  config: { encoding?: BufferEncoding },
): SyncDataSource {
  return createFileDataSource("json", name, "json_data", () =>
    parseJsonRecords(readFileSync(path, config.encoding ?? "utf-8")),
  );
}

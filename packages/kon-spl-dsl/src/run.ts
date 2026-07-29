/**
 * runSplKon — 执行 Kon 源码的单函数门面（behavior run-spl-kon-facade）。
 *
 * 目标：宿主（如 web-server）无需任何 kunun 直接依赖即可执行 Kon 脚本——
 * Kunun 的 import 收敛在本包，并通过发布包的根导出消费运行时。
 *
 * 语义：
 * - 每次调用创建全新 kunun 运行时与 SplContext（无跨调用共享可变状态；
 *   fresh 开销毫秒级，findings 实证）；执行结束 close 全部数据源。
 * - source 先做大小检查（Buffer.byteLength，默认 65536 字节）再解析执行。
 * - bindings 采集定案：执行后对 Kon env 做快照（snapshotKonEnv，entry env →
 *   当前 env 的 Variables 合并），`#name` 绑定与 `(var x ...)` 绑定均可见；
 *   无需改动 SplContext / EnableSplDsl（向后兼容零成本），实测锁定于
 *   __tests__/run.test.ts。
 * - toQueryResult(value)：DataSet（instanceof 或 {schema, rows} duck 形态，
 *   如 spl_eval 透传 derive 的返回）→ {columns, rows}（columns 取 schema
 *   列名序）；已是 {columns, rows} 原样返回；标量/数组等非表格值返回 null。
 */
import { RuntimeInterpreter } from "kunun";
import { DataSet } from "depa-data-core";
import {
  createSplContext,
  openDataSource,
  type SplDataSourceConfig,
} from "./context";
import { EnableSplDsl } from "./enable";
import { snapshotKonEnv, type KununRuntime } from "./words/shared";

/** 默认源码大小上限（字节）：64KB，与 web-server 端约定一致。 */
export const DEFAULT_MAX_SOURCE_BYTES = 65536;

export interface RunSplKonConfig {
  /** 文件路径沙箱根；默认 process.cwd()（同 createSplContext） */
  workspaceRoot?: string;
  /** spl_eval 的初始 scope */
  scope?: Record<string, unknown>;
  /** 执行前注册的数据源（脚本内经 conn = <name> 引用） */
  dataSources?: SplDataSourceConfig[];
  /** 源码大小上限（字节）；默认 DEFAULT_MAX_SOURCE_BYTES */
  maxSourceBytes?: number;
  /** Caller-owned uploaded tables, cloned and bound as DataSets for this run. */
  tables?: Record<string, QueryResultData>;
}

export interface RunSplKonResult {
  /** 脚本最后一个表达式的值 */
  value: unknown;
  /** 执行后 Kon env 快照（#name 与 var 绑定） */
  bindings: Record<string, unknown>;
}

/** 与 depa-data-web-shared QueryResultData 同构的归一形态。 */
export interface QueryResultData {
  columns: string[];
  rows: Record<string, unknown>[];
}

/**
 * 同步执行一段 Kon 源码：大小检查 → fresh SplContext（注册 dataSources）→
 * fresh kunun 运行时 + EnableSplDsl → EvalBlockSourceWithRuntimeSync。
 * 执行结束（含抛错路径）close 全部数据源。
 */
export function runSplKon(
  source: string,
  config: RunSplKonConfig = {},
): RunSplKonResult {
  const maxSourceBytes = config.maxSourceBytes ?? DEFAULT_MAX_SOURCE_BYTES;
  const sourceBytes = Buffer.byteLength(source, "utf-8");
  if (sourceBytes > maxSourceBytes) {
    throw new Error(
      `runSplKon：source 大小 ${sourceBytes} 字节超过限制 ` +
        `${maxSourceBytes} 字节（maxSourceBytes）`,
    );
  }

  const ctx = createSplContext({
    workspaceRoot: config.workspaceRoot,
    scope: { ...config.scope },
  });
  try {
    for (const [name, table] of Object.entries(config.tables ?? {})) {
      if (!/^[\p{L}_][\p{L}\p{N}_]*$/u.test(name) || ["__proto__", "constructor", "prototype"].includes(name)) throw new Error(`Invalid table binding name: ${name}`);
      if (!Array.isArray(table.columns) || !table.columns.every((col) => typeof col === "string") || new Set(table.columns).size !== table.columns.length || !Array.isArray(table.rows)
        || table.rows.some((row) => !row || typeof row !== "object" || Array.isArray(row))) throw new Error(`Invalid table: ${name}`);
      if (Object.prototype.hasOwnProperty.call(ctx.scope, name)) throw new Error(`Table binding conflicts with scope: ${name}`);
      const copy = structuredClone(table);
      ctx.scope[name] = new DataSet(copy.columns.map((column) => ({ name: column, type: "unknown" })), copy.rows);
    }
    for (const dsConfig of config.dataSources ?? []) {
      openDataSource(ctx, dsConfig);
    }
    const runtime = RuntimeInterpreter.CreateRuntime();
    for (const name of Object.keys(config.tables ?? {})) (runtime as unknown as KununRuntime).define(name, ctx.scope[name]);
    EnableSplDsl(runtime as unknown as KununRuntime, ctx);
    const value: unknown = RuntimeInterpreter.EvalBlockSourceWithRuntimeSync(
      runtime,
      source,
    );
    return { value, bindings: snapshotKonEnv(runtime as unknown as KununRuntime) };
  } finally {
    for (const ds of ctx.dataSources.values()) {
      ds.close?.();
    }
  }
}

/** {schema, rows} duck 形态判定（DataSet 形态，未必是 instanceof）。 */
function isDataSetShape(
  v: unknown,
): v is { schema: Array<{ name: string }>; rows: Record<string, unknown>[] } {
  if (v === null || typeof v !== "object") return false;
  const o = v as { schema?: unknown; rows?: unknown };
  return (
    Array.isArray(o.schema) &&
    o.schema.every(
      (c) => c !== null && typeof c === "object" && typeof (c as { name?: unknown }).name === "string",
    ) &&
    Array.isArray(o.rows)
  );
}

/** {columns, rows} 形态判定（已归一）。 */
function isQueryResultShape(v: unknown): v is QueryResultData {
  if (v === null || typeof v !== "object") return false;
  const o = v as { columns?: unknown; rows?: unknown };
  return (
    Array.isArray(o.columns) &&
    o.columns.every((c) => typeof c === "string") &&
    Array.isArray(o.rows)
  );
}

/**
 * 把执行结果归一为 QueryResultData；非表格值（标量/数组/普通对象）返回 null。
 */
export function toQueryResult(value: unknown): QueryResultData | null {
  if (value instanceof DataSet || isDataSetShape(value)) {
    return {
      columns: value.schema.map((c) => c.name),
      rows: value.rows as Record<string, unknown>[],
    };
  }
  if (isQueryResultShape(value)) {
    return value;
  }
  return null;
}

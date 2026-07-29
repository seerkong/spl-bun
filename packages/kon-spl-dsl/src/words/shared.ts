/**
 * words/shared — spl_* word 展开器的公共壳与公共解析逻辑。
 *
 * 关键事实（见 track findings）：
 * - prefix keyword 展开器签名 `(runtime, { knot, sourceNodeId })`，在解释器
 *   执行到该节点时才展开（lazy，实测），因此展开时同步执行业务逻辑即可，
 *   此前语句定义的 env 变量已可见。
 * - 回值必须 `runtime.addOpDirectly(RuntimeOpCode.PushValue, v)`（枚举）。
 * - `#name` 绑定：kunun RuntimeState 有公开 `define(key, obj)`（当前 env
 *   定义变量，与 `var` 关键字同一底层 Env.Define），实测后续 Kon 表达式
 *   可引用 → 采用 push + define 双通道（decisions.md #5）。
 * - Kon env 可见变量快照：公开 `envTree.GetAllVertexDetailsFromEntryToVertex(
 *   currentEnvId, true)` + `Env.Variables`（与 kunun 内部闭包快照同源逻辑）。
 */
import { RuntimeOpCode } from "kunun";
import { DataSet } from "depa-data-core";
import {
  isKnWord,
  normalizeKnValue,
  readWordCall,
  type WordCall,
} from "../knot-reader";
import type { SplContext, SyncDataSource } from "../context";

/** kunun RuntimeState 的最小结构接口（本包只依赖这些公开成员） */
export interface KununRuntime {
  addOpDirectly(opCode: unknown, memo?: unknown): unknown;
  define(key: string, obj: unknown): void;
  lookup(key: string): unknown;
  hasBinding(key: string): boolean;
  currentEnvId: number;
  envTree: {
    GetAllVertexDetailsFromEntryToVertex(
      envId: number,
      includeSelf: boolean,
    ): Array<{ Variables: Map<unknown, unknown> }>;
  };
  registerPrefixKeyword(
    keyword: string,
    expander: (runtime: unknown, nodeToRun: { knot: unknown }) => void,
  ): void;
}

/**
 * 公共壳：readWordCall → 同步执行 → PushValue 结果 → `#name` 时 env 绑定。
 */
export function expandWord(
  runtime: KununRuntime,
  knot: unknown,
  execute: (call: WordCall) => unknown,
): void {
  const call = readWordCall(knot);
  const value = execute(call);
  if(value instanceof Promise){
    void value.catch(()=>{});
    throw new Error("Synchronous Kon cannot consume a Promise; use async evaluateFlow or the host cursor API");
  }
  runtime.addOpDirectly(RuntimeOpCode.PushValue, value);
  if (call.name) {
    runtime.define(call.name, value);
  }
}

/** 结构判断：SyncDataSource 句柄（duck typing，句柄可能来自 env 变量） */
export function isDataSourceHandle(v: unknown): v is SyncDataSource {
  return (
    v != null &&
    typeof v === "object" &&
    typeof (v as SyncDataSource).query === "function"
  );
}

/**
 * 解析 conf.conn → SyncDataSource。
 *
 * 规则（实测锁定）：Conf 中 `conn = db`（裸标识符）与 `conn = "db"`（字符串）
 * 经 readWordCall 归一后都是字符串名；解析顺序：
 * 1. ctx.dataSources 注册表按名取；
 * 2. 回退 Kon env 绑定（`#db` 命名绑定的句柄，或 `(var c (spl_connect ...))`）；
 * 3. 若 conn 已是句柄对象（如经 scope 传入）直接使用。
 */
export function resolveConn(
  ctx: SplContext,
  runtime: KununRuntime,
  conn: unknown,
  word: string,
): SyncDataSource {
  if (isDataSourceHandle(conn)) {
    return conn;
  }
  if (typeof conn !== "string" || conn.length === 0) {
    throw new Error(`${word}：Conf 缺少 conn（数据源名或句柄）`);
  }
  const fromRegistry = ctx.dataSources.get(conn);
  if (fromRegistry) {
    return fromRegistry;
  }
  if (runtime.hasBinding(conn)) {
    const bound = runtime.lookup(conn);
    if (isDataSourceHandle(bound)) {
      return bound;
    }
  }
  throw new Error(
    `${word}：未知数据源 "${conn}"（既不在 SplContext 注册表，也不是 env 中绑定的句柄）`,
  );
}

/** conf.sql 归一：必须是非空字符串（requireSql=false 时允许缺省，返回 undefined） */
export function readSql(
  conf: Record<string, unknown>,
  word: string,
  requireSql: boolean,
): string | undefined {
  const sql = conf.sql;
  if (sql === undefined || sql === null) {
    if (requireSql) {
      throw new Error(`${word}：Conf 缺少 sql`);
    }
    return undefined;
  }
  if (typeof sql !== "string") {
    throw new Error(`${word}：Conf 的 sql 必须是字符串`);
  }
  return sql;
}

/** conf.params 归一：可选数组 */
export function readParams(conf: Record<string, unknown>): unknown[] | undefined {
  const params = conf.params;
  if (params === undefined || params === null) return undefined;
  if (!Array.isArray(params)) {
    throw new Error("Conf 的 params 必须是数组");
  }
  return params;
}

/**
 * Kon env 可见变量快照（entry env → 当前 env，后者覆盖前者）。
 * 实现从简（快照即可，findings 记录）；builtin/global env 的 Variables
 * 默认为空，不会污染 scope。
 */
export function snapshotKonEnv(runtime: KununRuntime): Record<string, unknown> {
  const values: Record<string, unknown> = {};
  const envs = runtime.envTree.GetAllVertexDetailsFromEntryToVertex(
    runtime.currentEnvId,
    true,
  );
  for (const env of envs) {
    for (const [key, value] of env.Variables.entries()) {
      values[String(key)] = value;
    }
  }
  return values;
}

/**
 * conf.with 归一：Kon map 字面量（KnUnorderedMap，entries 即自有属性）→
 * plain object；值中的裸标识符（KnWord）取 .Value 归一为字符串。
 */
export function normalizeWith(withValue: unknown): Record<string, unknown> {
  if (withValue === undefined || withValue === null) return {};
  if (typeof withValue !== "object") {
    throw new Error("spl_eval：Conf 的 with 必须是 map");
  }
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(withValue as Record<string, unknown>)) {
    out[k] = isKnWord(v) ? v.Value : v;
  }
  return out;
}

// ---------------------------------------------------------------------------
// 原生数据运算 word 公共设施（track add-kon-spl-native-words，只做加法）
// ---------------------------------------------------------------------------

/**
 * 原生 word 拒绝 `#opt`/`@糖` 选项通道（decisions.md #1：原生 word 直接调
 * DataSet API，无成员函数选项通道；`#opt` 语义保留给透传层）。
 * 在 readWordCall 读取 knot 之后、执行业务之前调用。
 */
export function rejectNativeOptions(call: WordCall, word: string): void {
  if (call.options.length > 0) {
    throw new Error(
      `${word}：原生 word 不接受 #opt/@ 选项（收到 "${call.options}"），` +
        `模式请用 Conf 键表达，或改用 spl_eval 透传 SPL 选项`,
    );
  }
}

/**
 * 解析 Conf 的数据集键（in / left / right）→ DataSet。
 *
 * 规则（delta native-words-common）：
 * 1. 值本身是 DataSet（如程序化调用或经 scope 传入）→ 直接使用；
 * 2. 值为字符串名（Conf 裸标识符归一为字符串）→ 先查 Kon env 绑定，
 *    再回退 ctx.scope；
 * 3. 解析失败报错含名字。
 */
export function resolveDataSet(
  ctx: SplContext,
  runtime: KununRuntime,
  confValue: unknown,
  word: string,
  key = "in",
): DataSet {
  const direct = dataSetValue(confValue);
  if (direct) return direct;
  if (typeof confValue !== "string" || confValue.length === 0) {
    throw new Error(`${word}：Conf 缺少 ${key}（DataSet 变量名或 DataSet 值）`);
  }
  if (runtime.hasBinding(confValue)) {
    const bound = runtime.lookup(confValue);
    const data = dataSetValue(bound);
    if (data) return data;
  }
  const fromScope = ctx.scope[confValue];
  const data = dataSetValue(fromScope);
  if (data) return data;
  throw new Error(
    `${word}：Conf 的 ${key} = "${confValue}" 未解析到 DataSet` +
      `（Kon env 与 ctx.scope 中都没有该名的 DataSet）`,
  );
}

/** Expression member tables and native words share the same value contract. */
function dataSetValue(value: unknown): DataSet | undefined {
  if (value instanceof DataSet) return value;
  if (!value || typeof value !== "object" || !("rows" in value) || !Array.isArray(value.rows)) return undefined;
  let schema: Array<{name:string;type:string}>;
  if ("schema" in value && Array.isArray(value.schema)) {
    schema = value.schema.map(column => {
      if (!column || typeof column !== "object" || typeof column.name !== "string") throw new Error("Invalid expression table schema");
      return {name:column.name,type:typeof column.type === "string" ? column.type : "unknown"};
    });
  } else if ("columns" in value && Array.isArray(value.columns) && value.columns.every(column=>typeof column === "string")) {
    schema = value.columns.map(name=>({name,type:"unknown"}));
  } else return undefined;
  if (new Set(schema.map(column=>column.name)).size !== schema.length || value.rows.some(row=>!row || typeof row !== "object" || Array.isArray(row))) throw new Error("Invalid expression table rows or duplicate columns");
  return new DataSet(schema,value.rows);
}

/**
 * Conf 中 Kon map 字面量键（cols / agg / with 等）归一为 plain object；
 * 值中的裸标识符（KnWord）取 .Value。缺省返回 {}。
 */
export function readConfMap(
  conf: Record<string, unknown>,
  key: string,
  word: string,
): Record<string, unknown> {
  const v = conf[key];
  if (v === undefined || v === null) return {};
  if (typeof v !== "object" || Array.isArray(v)) {
    throw new Error(`${word}：Conf 的 ${key} 必须是 map`);
  }
  const out: Record<string, unknown> = {};
  for (const [k, value] of Object.entries(v as Record<string, unknown>)) {
    out[k] = normalizeKnValue(value);
  }
  return out;
}

/**
 * 原生 word 表达式 scope 组装：ctx.scope ⊕ Kon env 快照 ⊕ with（后覆盖前，
 * 与 spl_eval 同序）。行字段的最终遮蔽发生在引擎侧（withComputedColumns /
 * filterExpr 以 {...scope, ...row} 求值，行字段优先）。
 */
export function buildNativeScope(
  ctx: SplContext,
  runtime: KununRuntime,
  withMap: Record<string, unknown>,
): Record<string, unknown> {
  return { ...ctx.scope, ...snapshotKonEnv(runtime), ...withMap };
}

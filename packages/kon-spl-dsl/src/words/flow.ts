/**
 * spl_flow — 用 depa-data-spl-flow 的 evaluateFlowSync 整体执行 Conf.cells
 * 描述的 FlowCell 网格脚本，返回其 result。
 *
 * - cells：vector of map（row/col/expr）；map 值来自 Kon（KnUnorderedMap，
 *   值中裸标识符是 KnWord）→ 经 knot-reader 的 normalizeKnValue 归一。
 * - FlowExecutionContext 派生规则（从 SplContext）：
 *   - workspaceRoot 透传；
 *   - scope 透传（浅拷贝，evaluateFlow 系列会往 scope 写单元格值）；
 *   - ctx.dataSources 中的 sqlite 数据源 → connections（name → DBConnection）
 *     + 同步 sqliteQuery/sqliteExecute adapter（按 connection.name 分派到
 *     SyncDataSource，返回值而非 Promise → 满足 evaluateFlowSync 同步约束）。
 *     csv/json 数据源不进 connections（网格内用 T()/file() 直接读文件）。
 * - result 语义（锁定，与 evaluateFlowSync 返回结构一致）：任一单元格
 *   status=error 则抛错；否则优先 result（result 命令值）→ lastQuery →
 *   最后一个产生值的单元格的值。
 */
import {
  evaluateFlowSync,
  type DBConnection,
  type FlowCell,
  type FlowEvaluationResult,
  type FlowExecutionContext,
} from "depa-data-spl-flow";
import type { SplContext, SyncDataSource } from "../context";
import { normalizeKnValue, type WordCall } from "../knot-reader";

/** Conf.cells 归一：vector of map → FlowCell[]（KnWord 值取 .Value） */
function normalizeCells(raw: unknown): FlowCell[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    throw new Error("spl_flow：Conf 缺少 cells（非空的 FlowCell 数组）");
  }
  return raw.map((entry, i) => {
    if (entry == null || typeof entry !== "object") {
      throw new Error(`spl_flow：cells[${i}] 必须是 map（含 row/col/expr）`);
    }
    const rec = entry as Record<string, unknown>;
    const row = normalizeKnValue(rec.row);
    const col = normalizeKnValue(rec.col);
    const expr = normalizeKnValue(rec.expr);
    if (typeof row !== "number" || !Number.isInteger(row) || row < 1) {
      throw new Error(`spl_flow：cells[${i}].row 必须是正整数`);
    }
    if (typeof col !== "string" || col.length === 0) {
      throw new Error(`spl_flow：cells[${i}].col 必须是非空字符串`);
    }
    if (typeof expr !== "string") {
      throw new Error(`spl_flow：cells[${i}].expr 必须是字符串`);
    }
    return { row, col, expr };
  });
}

/** SplContext → FlowExecutionContext（sqlite 数据源 → connections + 同步 adapter） */
export function deriveFlowContext(ctx: SplContext): FlowExecutionContext {
  const connections = new Map<string, DBConnection>();
  const sqliteSources = new Map<string, SyncDataSource>();
  for (const [name, ds] of ctx.dataSources) {
    if (ds.type === "sqlite") {
      connections.set(name, { name, type: "sqlite" });
      sqliteSources.set(name, ds);
    }
  }
  const requireSource = (connection?: DBConnection): SyncDataSource => {
    const name = connection?.name;
    const ds = name ? sqliteSources.get(name) : undefined;
    if (!ds) {
      throw new Error(
        `spl_flow：未知 sqlite 数据源 "${name ?? "(默认)"}"（不在 SplContext.dataSources）`,
      );
    }
    return ds;
  };
  return {
    workspaceRoot: ctx.workspaceRoot,
    scope: { ...ctx.scope },
    connections,
    adapters: {
      sqliteQuery: ({ connection, sql, params }) =>
        requireSource(connection).query(sql, params),
      sqliteExecute: ({ connection, sql, params }) => {
        const ds = requireSource(connection);
        if (typeof ds.execute !== "function") {
          throw new Error(`spl_flow：数据源 "${ds.name}" 不支持 execute`);
        }
        return ds.execute(sql, params);
      },
    },
  };
}

/** result 选取（锁定语义）：错误单元格抛错；result → lastQuery → 最后表达式值。 */
function pickFlowResult(res: FlowEvaluationResult): unknown {
  const failed = res.cells.find((c) => c.status === "error");
  if (failed) {
    throw new Error(
      `spl_flow：单元格 ${failed.col}${failed.row} 求值失败：${failed.error}`,
    );
  }
  if (res.result !== undefined) return res.result;
  if (res.lastQuery !== undefined) return res.lastQuery;
  for (let i = res.cells.length - 1; i >= 0; i -= 1) {
    const cell = res.cells[i];
    if (cell.status === "ok" && "result" in cell) return cell.result;
  }
  return null;
}

export function executeFlow(ctx: SplContext, call: WordCall): unknown {
  const cells = normalizeCells(call.conf.cells);
  const res = evaluateFlowSync(cells, deriveFlowContext(ctx));
  return pickFlowResult(res);
}

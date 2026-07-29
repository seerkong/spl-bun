import { DataSet } from "depa-data-core";
import { compileAggregateExpression } from "depa-data-expression";
import { normalizeKnValue } from "../knot-reader";
import type { SplContext } from "../context";
import type { WordCall } from "../knot-reader";
import {
  buildNativeScope,
  readConfMap,
  rejectNativeOptions,
  resolveDataSet,
  type KununRuntime,
} from "./shared";

/** conf.keys 归一：缺省/空数组 → []；元素（裸标识符 KnWord）归一为列名字符串 */
function readKeys(conf: Record<string, unknown>): string[] {
  const raw = conf.keys;
  if (raw === undefined || raw === null) return [];
  if (!Array.isArray(raw)) {
    throw new Error("spl_groups：Conf 的 keys 必须是数组（分组列名列表）");
  }
  return raw.map((item) => {
    const v = normalizeKnValue(item);
    if (typeof v !== "string" || v.length === 0) {
      throw new Error("spl_groups：keys 元素必须是列名（裸标识符或字符串）");
    }
    return v;
  });
}

export function executeGroups(
  ctx: SplContext,
  runtime: KununRuntime,
  call: WordCall,
): DataSet {
  rejectNativeOptions(call, "spl_groups");
  const input = resolveDataSet(ctx, runtime, call.conf.in, "spl_groups");
  const keys = readKeys(call.conf);
  const rawAgg = readConfMap(call.conf, "agg", "spl_groups");
  if (Object.keys(rawAgg).length === 0) {
    throw new Error("spl_groups：Conf 缺少 agg（{输出列 = 聚合表达式} map）");
  }
  const scope = buildNativeScope(
    ctx,
    runtime,
    readConfMap(call.conf, "with", "spl_groups"),
  );

  const aggregates: Record<string, (rows: Array<Record<string, unknown>>) => unknown> = {};
  for (const [alias, exprStr] of Object.entries(rawAgg)) {
    if (typeof exprStr !== "string" || exprStr.length === 0) {
      throw new Error(`spl_groups：agg 的 ${alias} 必须是非空聚合表达式字符串`);
    }
    try {
      aggregates[alias] = compileAggregateExpression(exprStr, input.schema.map(column => column.name), scope);
    } catch (error) {
      throw new Error("spl_groups: agg " + alias + " (" + exprStr + "): " + (error instanceof Error ? error.message : String(error)));
    }
  }

  return input.aggregate({ groupBy: keys, aggregates });
}

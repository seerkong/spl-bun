/**
 * spl_derive — 原生行级新列计算：Conf{in, cols = {列名 = 行表达式}, with?}。
 *
 * - in 经 resolveDataSet 解析（DataSet 值直接用；字符串名查 Kon env →
 *   ctx.scope）。
 * - 不接受 #opt/@ 糖（rejectNativeOptions，decisions.md #1）。
 * - scope = ctx.scope ⊕ Kon env 快照 ⊕ with（与 spl_eval 同序）；引擎侧
 *   DataSet.withComputedColumns 以 {...scope, ...row} 求值 → 行字段优先
 *   于 with/env 同名变量。列表达式可直接引用 with/env 变量，消除字符串
 *   透传的 `:alias` 与内层 scope 限制（delta native-derive-select）。
 */
import type { DataSet } from "depa-data-core";
import type { SplContext } from "../context";
import type { WordCall } from "../knot-reader";
import {
  buildNativeScope,
  readConfMap,
  rejectNativeOptions,
  resolveDataSet,
  type KununRuntime,
} from "./shared";

export function executeDerive(
  ctx: SplContext,
  runtime: KununRuntime,
  call: WordCall,
): DataSet {
  rejectNativeOptions(call, "spl_derive");
  const input = resolveDataSet(ctx, runtime, call.conf.in, "spl_derive");
  const rawCols = readConfMap(call.conf, "cols", "spl_derive");
  if (Object.keys(rawCols).length === 0) {
    throw new Error("spl_derive：Conf 缺少 cols（{列名 = 行表达式} map）");
  }
  const cols: Record<string, string> = {};
  for (const [name, expr] of Object.entries(rawCols)) {
    if (typeof expr !== "string" || expr.length === 0) {
      throw new Error(`spl_derive：cols 的 ${name} 必须是非空表达式字符串`);
    }
    cols[name] = expr;
  }
  const scope = buildNativeScope(
    ctx,
    runtime,
    readConfMap(call.conf, "with", "spl_derive"),
  );
  return input.withComputedColumns(cols, scope);
}

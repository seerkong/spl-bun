/**
 * spl_select — 原生行过滤：Conf{in, where = 谓词表达式, with?}。
 *
 * - in 经 resolveDataSet 解析（DataSet 值直接用；字符串名查 Kon env →
 *   ctx.scope）。
 * - 不接受 #opt/@ 糖（rejectNativeOptions，decisions.md #1）。
 * - scope = ctx.scope ⊕ Kon env 快照 ⊕ with（与 spl_eval 同序）；引擎侧
 *   DataSet.filterExpr 以 {...scope, ...row} 求值 → 行字段优先，where
 *   谓词可直接引用 with/env 变量（delta native-derive-select）。
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

export function executeSelect(
  ctx: SplContext,
  runtime: KununRuntime,
  call: WordCall,
): DataSet {
  rejectNativeOptions(call, "spl_select");
  const input = resolveDataSet(ctx, runtime, call.conf.in, "spl_select");
  const where = call.conf.where;
  if (typeof where !== "string" || where.length === 0) {
    throw new Error("spl_select：Conf 缺少 where（谓词表达式字符串）");
  }
  const scope = buildNativeScope(
    ctx,
    runtime,
    readConfMap(call.conf, "with", "spl_select"),
  );
  return input.filterExpr(where, scope);
}

/**
 * spl_top — 排序后取前 n 行：Conf{in, n, by, desc?}。
 *
 * 语义（decisions.md #3 + T2.1 锁定）：
 * - 实现路径 = spl_sort 复用（sortDataSet 单键）+ slice（引擎无现成 top
 *   over groupless rows 的直接方法；aggregateWithGather 的 top 只回值列表
 *   不回整行，覆盖面不够）。
 * - by 为单个列名（字符串或裸标识符）；desc 缺省 false（升序取最小 n 行，
 *   对齐 SPL A.top(n, x) 缺省语义），desc = true 取最大 n 行。
 * - n 必须为正数；n 超过行数返回全部行；排序稳定（并列保持输入相对序）。
 * - in 经 resolveDataSet 解析；不接受 #opt/@ 糖。
 */
import { DataSet } from "depa-data-core";
import { normalizeKnValue } from "../knot-reader";
import type { SplContext } from "../context";
import type { WordCall } from "../knot-reader";
import {
  rejectNativeOptions,
  resolveDataSet,
  type KununRuntime,
} from "./shared";
import { readBoolFlag, sortDataSet } from "./sort";

export function executeTop(
  ctx: SplContext,
  runtime: KununRuntime,
  call: WordCall,
): DataSet {
  rejectNativeOptions(call, "spl_top");
  const input = resolveDataSet(ctx, runtime, call.conf.in, "spl_top");

  const n = call.conf.n;
  if (typeof n !== "number" || !Number.isFinite(n) || n <= 0) {
    throw new Error(`spl_top：Conf 的 n 必须是正数（收到 ${String(n)}）`);
  }

  const by = normalizeKnValue(call.conf.by);
  if (typeof by !== "string" || by.length === 0) {
    throw new Error("spl_top：Conf 缺少 by（排序列名）");
  }

  const desc = readBoolFlag(call.conf.desc);
  const sorted = sortDataSet(input, [{ col: by, desc }]);
  return new DataSet(sorted.schema, sorted.rows.slice(0, n));
}

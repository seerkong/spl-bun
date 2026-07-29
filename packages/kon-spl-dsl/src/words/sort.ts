/**
 * spl_sort — 原生多键排序：Conf{in, by = 列名 | [列名或 {col, desc}]}。
 *
 * 列配置适配到共享 expression.sortRows；schema 保持，输入不变。
 * 行表达式、排序选项和locale协议通过 spl_eval 的成员sort暴露。
 *
 * - by 形态：单键字符串简写 `by = "amount"`；数组项可为列名（裸标识符或
 *   字符串）或 map `{col = amount desc = true}`（desc 缺省 false 升序）。
 * - 精确数值/Date/null及多键稳定性复用共享处理器。
 * - in 经 resolveDataSet 解析；不接受 #opt/@ 糖（rejectNativeOptions）。
 */
import { DataSet } from "depa-data-core";
import { assertKnownColumns, sortRows } from "depa-data-expression";
import { normalizeKnValue } from "../knot-reader";
import type { SplContext } from "../context";
import type { WordCall } from "../knot-reader";
import {
  rejectNativeOptions,
  resolveDataSet,
  type KununRuntime,
} from "./shared";

export interface SortKey {
  col: string;
  desc: boolean;
}

/** Kon 布尔归一：Kon 源码的 `true` 可能以裸标识符（KnWord → "true"）到达 */
export function readBoolFlag(v: unknown): boolean {
  const n = normalizeKnValue(v);
  return n === true || n === "true";
}

/** conf.by 归一 → SortKey[]（供 spl_top 复用单键形态） */
export function readSortBy(byRaw: unknown, word: string): SortKey[] {
  const single = normalizeKnValue(byRaw);
  if (typeof single === "string" && single.length > 0) {
    return [{ col: single, desc: false }];
  }
  if (byRaw === undefined || byRaw === null) {
    throw new Error(`${word}：Conf 缺少 by（列名或 [列名 | {col, desc}] 数组）`);
  }
  if (!Array.isArray(byRaw)) {
    throw new Error(`${word}：Conf 的 by 必须是列名或数组`);
  }
  if (byRaw.length === 0) {
    throw new Error(`${word}：Conf 的 by 不能为空数组`);
  }
  return byRaw.map((item) => {
    const v = normalizeKnValue(item);
    if (typeof v === "string" && v.length > 0) {
      return { col: v, desc: false };
    }
    if (v != null && typeof v === "object" && !Array.isArray(v)) {
      const entry = v as Record<string, unknown>;
      if (Object.keys(entry).some(key => key !== 'col' && key !== 'desc'))
        throw new Error(`${word}：by 的 map 仅支持 col/desc`);
      const col = normalizeKnValue(entry.col);
      if (typeof col !== "string" || col.length === 0) {
        throw new Error(`${word}：by 的 map 项必须含 col（列名）`);
      }
      const desc = normalizeKnValue(entry.desc);
      if (desc !== undefined && desc !== true && desc !== false && desc !== 'true' && desc !== 'false')
        throw new Error(`${word}：desc 必须是布尔值`);
      return { col, desc: readBoolFlag(desc) };
    }
    throw new Error(`${word}：by 项必须是列名（裸标识符或字符串）或 {col, desc} map`);
  });
}

/** 返回新 DataSet；这里只转换列配置，不复制排序语义。 */
export function sortDataSet(input: DataSet, keys: SortKey[]): DataSet {
  assertKnownColumns(keys.map(key => key.col), input.schema.map(column => column.name));
  const rows = sortRows(input.rows, keys.map(({col,desc}) => ({value:row=>row[col],direction:desc?-1:1})));
  return new DataSet(input.schema, rows);
}

export function executeSort(
  ctx: SplContext,
  runtime: KununRuntime,
  call: WordCall,
): DataSet {
  rejectNativeOptions(call, "spl_sort");
  const input = resolveDataSet(ctx, runtime, call.conf.in, "spl_sort");
  const keys = readSortBy(call.conf.by, "spl_sort");
  return sortDataSet(input, keys);
}

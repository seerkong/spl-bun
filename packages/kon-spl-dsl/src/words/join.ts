/**
 * spl_join — 原生连接：Conf{left, right, type = "inner"|"left",
 * on = [键] 或 leftOn/rightOn, rightPrefix?}。
 *
 * 直接映射引擎 DataSet.join(other, spec)（findings T2.1 实测）：
 * - Conf on → spec.leftKeys（rightKeys 缺省 = leftKeys，同名键）；
 *   leftOn/rightOn → leftKeys/rightKeys（异名键，长度由引擎校验）。
 * - type → spec.type（缺省 "inner"；仅 inner/left，引擎 JoinType 面）。
 * - rightPrefix → spec.rightPrefix（右表同名列前缀，引擎缺省 "right_"）。
 * - left join 未匹配行的右表列由引擎补 undefined（mergeRows 按右表
 *   schema 补列）。
 * - left/right 经 resolveDataSet 解析；不接受 #opt/@ 糖。
 */
import type { DataSet, JoinSpec } from "depa-data-core";
import { normalizeKnValue } from "../knot-reader";
import type { SplContext } from "../context";
import type { WordCall } from "../knot-reader";
import {
  rejectNativeOptions,
  resolveDataSet,
  type KununRuntime,
} from "./shared";

/** Conf 键列表（on / leftOn / rightOn）归一：数组项 → 列名字符串 */
function readKeyList(
  conf: Record<string, unknown>,
  key: string,
): string[] | undefined {
  const raw = conf[key];
  if (raw === undefined || raw === null) return undefined;
  if (!Array.isArray(raw) || raw.length === 0) {
    throw new Error(`spl_join：Conf 的 ${key} 必须是非空数组（键列名列表）`);
  }
  return raw.map((item) => {
    const v = normalizeKnValue(item);
    if (typeof v !== "string" || v.length === 0) {
      throw new Error(`spl_join：${key} 元素必须是列名（裸标识符或字符串）`);
    }
    return v;
  });
}

export function executeJoin(
  ctx: SplContext,
  runtime: KununRuntime,
  call: WordCall,
): DataSet {
  rejectNativeOptions(call, "spl_join");
  const left = resolveDataSet(ctx, runtime, call.conf.left, "spl_join", "left");
  const right = resolveDataSet(ctx, runtime, call.conf.right, "spl_join", "right");

  const type = call.conf.type === undefined || call.conf.type === null
    ? "inner"
    : call.conf.type;
  if (!["inner","left","right","full","semi","anti"].includes(String(type))) {
    throw new Error(
      `spl_join：Conf 的 type 必须是 "inner" 或 "left"（收到 "${String(type)}"）`,
    );
  }

  const on = readKeyList(call.conf, "on");
  const leftOn = readKeyList(call.conf, "leftOn");
  const rightOn = readKeyList(call.conf, "rightOn");

  let leftKeys: string[];
  let rightKeys: string[] | undefined;
  if (on) {
    leftKeys = on;
  } else if (leftOn || rightOn) {
    if (!leftOn || !rightOn) {
      throw new Error("spl_join：leftOn 与 rightOn 必须成对给出（异名键连接）");
    }
    leftKeys = leftOn;
    rightKeys = rightOn;
  } else {
    throw new Error("spl_join：Conf 缺少 on（同名键）或 leftOn/rightOn（异名键）");
  }

  const spec: JoinSpec = { type: type as JoinSpec["type"], leftKeys };
  if (rightKeys) spec.rightKeys = rightKeys;
  const rightPrefix = call.conf.rightPrefix;
  if (rightPrefix !== undefined && rightPrefix !== null) {
    if (typeof rightPrefix !== "string" || rightPrefix.length === 0) {
      throw new Error("spl_join：Conf 的 rightPrefix 必须是非空字符串");
    }
    spec.rightPrefix = rightPrefix;
  }

  return left.join(right, spec);
}

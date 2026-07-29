/**
 * spl_execute — 按 Conf{conn, sql, params?} 同步执行 DML/DDL，返回 {changes}。
 *
 * 仅 sqlite 数据源支持（文件型数据源无 execute 通道 → 报错）。
 */
import type { SplContext } from "../context";
import type { WordCall } from "../knot-reader";
import { readParams, readSql, resolveConn, type KununRuntime } from "./shared";

export function executeExecute(
  ctx: SplContext,
  runtime: KununRuntime,
  call: WordCall,
): { changes: number } {
  const ds = resolveConn(ctx, runtime, call.conf.conn, "spl_execute");
  const sql = readSql(call.conf, "spl_execute", true)!;
  if (typeof ds.execute !== "function") {
    throw new Error(
      `spl_execute：数据源 "${ds.name}"（${ds.type}）不支持 execute（仅 sqlite 支持 DML/DDL）`,
    );
  }
  return ds.execute(sql, readParams(call.conf));
}

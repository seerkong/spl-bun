/**
 * spl_query — 按 Conf{conn, sql?, params?} 同步执行查询，返回 DataSet。
 *
 * sql 可省：文件型数据源（csv/json）无 sql 表示全量读取；sqlite 数据源
 * 无 sql 由数据源自身抛错（"sqlite data source requires sql"）。
 */
import type { DataSet } from "depa-data-core";
import type { SplContext } from "../context";
import type { WordCall } from "../knot-reader";
import { readParams, readSql, resolveConn, type KununRuntime } from "./shared";

export function executeQuery(
  ctx: SplContext,
  runtime: KununRuntime,
  call: WordCall,
): DataSet {
  const ds = resolveConn(ctx, runtime, call.conf.conn, "spl_query");
  const sql = readSql(call.conf, "spl_query", false);
  return ds.query(sql, readParams(call.conf));
}

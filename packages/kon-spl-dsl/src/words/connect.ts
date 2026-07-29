/**
 * spl_connect — 按 Conf{type, path, ...} 同步注册/打开数据源并返回句柄。
 *
 * 名字来源：`#name`（命名同时用作注册名）优先，其次 Conf.name；两者皆无报错
 * （注册表需要名字，且 `conn = <名>` 依赖它）。
 * 路径经 SplContext.workspaceRoot 沙箱校验（openDataSource 内部）。
 */
import { openDataSource, type SplContext, type SplDataSourceConfig, type SyncDataSource } from "../context";
import type { WordCall } from "../knot-reader";

export function executeConnect(ctx: SplContext, call: WordCall): SyncDataSource {
  const { conf } = call;
  const type = conf.type;
  if (type !== "sqlite" && type !== "csv" && type !== "json") {
    throw new Error(
      `spl_connect：Conf 的 type 必须是 "sqlite" | "csv" | "json"，实际为 ${JSON.stringify(type)}`,
    );
  }
  const name = call.name ?? (typeof conf.name === "string" ? conf.name : undefined);
  if (!name) {
    throw new Error("spl_connect：缺少数据源名（用 #name 命名，或 Conf 提供 name）");
  }
  const path = conf.path;
  if (typeof path !== "string" || path.length === 0) {
    throw new Error("spl_connect：Conf 缺少 path");
  }
  const config = {
    type,
    name,
    path,
    ...(typeof conf.delimiter === "string" ? { delimiter: conf.delimiter } : {}),
    ...(typeof conf.hasHeader === "boolean" ? { hasHeader: conf.hasHeader } : {}),
    ...(typeof conf.encoding === "string" ? { encoding: conf.encoding } : {}),
  } as SplDataSourceConfig;
  return openDataSource(ctx, config);
}

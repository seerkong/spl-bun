/**
 * depa-data-kon-spl-dsl — 基于 kunun Kon 语言的 SPL 引擎封装调用方式。
 *
 * 导出：EnableSplDsl（注册 spl_connect / spl_query / spl_execute / spl_eval /
 * spl_flow 五个 word）+ SplContext 工厂 + knot 读取与选项改写纯函数。
 *
 * 本入口经 enable.ts 静态依赖已发布的 kunun 根包。
 */
export { EnableSplDsl } from "./enable";
export {
  runSplKon,
  toQueryResult,
  DEFAULT_MAX_SOURCE_BYTES,
  type RunSplKonConfig,
  type RunSplKonResult,
  type QueryResultData,
} from "./run";
export { type KununRuntime } from "./words/shared";
export { normalizeKnValue, readWordCall, type WordCall } from "./knot-reader";
export { applyOptions } from "./options";
export {
  createSplContext,
  openDataSource,
  resolveWorkspacePath,
  type SplContext,
  type SplContextConfig,
  type SplDataSourceConfig,
  type SyncDataSource,
} from "./context";

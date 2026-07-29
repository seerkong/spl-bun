# Design · retire-legacy-grid-flow-surfaces

## 上下文

G4 验证已证明 Kon 主路径可用：`KonIde.vue` 是 `/` 默认路由，`konDemos.ts` 覆盖 33 项旧 demo，新增 Kon E2E 与旧 grid E2E 双跑通过。G5 的职责是清退迁移期兼容层，而不是改引擎。

## 方案概览

1. 前端清退
   - router 删除 `/grid-legacy`，默认 `/` 保持 `KonIde`。
   - 删除旧 `SplIde.vue`、Univer grid 相关旧页面/测试引用（若无其他路由引用）。
   - 删除旧 grid E2E，保留 Kon E2E。
2. 服务端清退
   - 删除 `apiRoutes.execute` 对应旧 endpoint。
   - 删除 web-server 中旧 FlowCell endpoint handler、旧 flow scope/adapter only-for-endpoint 代码。
   - 若 demo DB 初始化仍被 Kon sqlite source 使用，则保留。
3. shared contract 清理
   - 删除旧 `ExecuteRequest` / `ExecuteResponse` / `ExecuteCellResult` / `apiRoutes.execute`。
   - 保留 `QueryResultData`、`KonExecuteRequest`、`KonExecuteResponse`、`apiRoutes.executeKon`。
4. 验证
   - `bun run --filter depa-data-web-ide build`
   - `bun run cleanup && bun run test:e2e`
   - `bun test`

## 风险与边界

- 旧端点测试会失效，需删除或改为 Kon-only 断言。
- `depa-data-spl-flow` 单元测试仍应全绿，这是保留引擎层的 guard。
- 删除 web-ide Univer 页面可能影响 `/univer-test`、`/no-formula-engine` 等演示 route；这些属于旧使用面，按 E5 可清退。

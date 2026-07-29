# 变更：服务端 Kon 执行链路（runSplKon 门面 + /api/execute-kon 端点）

## 背景和动机 (Context And Why)

mission migrate-flow-web-to-kon 的首批落地。web-server 目前只有 FlowCell 网格执行端点 /api/execute；前端切换到 Kon 脚本前，需要服务端具备执行 Kon 源码的能力。G1 spike 实证 kunun 依赖可收敛在 depa-data-kon-spl-dsl 单点（bun 按文件就近 tsconfig 解析）。

## "要做"和"不做" (Goals / Non-Goals)

**目标:**
- depa-data-kon-spl-dsl 新增 `runSplKon(source, config)` 门面与 `toQueryResult(value)` 归一 helper（每调用 fresh runtime/context、源码大小限制）。
- web-server 声明 workspace 依赖 depa-data-kon-spl-dsl，新增 POST /api/execute-kon（复用既有数据源清单，结构化错误）。
- 服务端 bun 测试（门面单测 + 端点级测试）；旧端点行为零回归。

**非目标:**
- 不改前端（G4 track）；不清退旧端点（G5 track）；不修改 kunun 与 depa-data-spl-flow；不做真超时中断（backlog）。

## 变更内容（What Changes）

- packages/kon-spl-dsl：新增 src/run.ts（runSplKon/toQueryResult），index.ts 导出；测试。
- packages/web-server：package.json 增依赖；server.ts 新增端点与数据源清单转换；测试（直接调用 Elysia handle 或抽出 handler 函数测试）。

## 影响范围（Impact）

- 能力：kon-spl-dsl（+run-spl-kon-facade）、新增 web-flow-api（execute-kon-endpoint）。
- 代码：packages/kon-spl-dsl/**、packages/web-server/**。

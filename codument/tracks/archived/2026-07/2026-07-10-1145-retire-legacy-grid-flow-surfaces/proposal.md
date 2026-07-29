# 变更：清退旧 FlowCell 网格使用面

## 背景和动机 (Context And Why)

mission `migrate-flow-web-to-kon` 已完成 G4：web-ide 默认路由切换为 KonIde，33 个 demos 已 Kon 化，Kon E2E 与旧 grid E2E 双跑通过。按 E5 决策，迁移期之后需要清退旧产品使用面，避免产品继续暴露两套执行模型。

## "要做"和"不做" (Goals / Non-Goals)

**目标:**
- 移除 web-ide 的旧 grid route、旧 grid demos、旧 grid E2E。
- 移除 web-server 旧 `/api/execute` FlowCell 产品端点及 web-shared 旧请求/响应类型。
- 保留 `/api/execute-kon`、KonIde、Kon demos、Kon E2E。
- 保持全仓 `bun test` 与 Playwright E2E 通过。

**非目标:**
- 不删除或改变 `depa-data-spl-flow`、FlowCell、evaluateFlow 引擎层能力。
- 不清退 kon-spl-dsl 的 `spl_flow` word。
- 不新增 Kon workbook IO / LSP / syntax highlight。

## 变更内容（What Changes）

- **BREAKING**：web-server 不再提供旧 `POST /api/execute` 产品端点。
- **BREAKING**：web-ide 不再提供 `/grid-legacy` route 或 Univer grid demo 页面。
- 删除旧 grid E2E 文件；保留并强化 Kon E2E。
- 清理 web-shared 中仅供旧 endpoint 使用的类型与 route 常量。

## 影响范围（Impact）

- 受影响的能力（behaviors）：`web-ide-kon`。
- 受影响的代码：`packages/web-ide/**`、`packages/web-server/**`、`packages/web-shared/**`。

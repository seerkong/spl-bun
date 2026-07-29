# Mission：migrate-flow-web-to-kon —— flow 使用面与前端切换为 Kon 语言

## 背景和动机

上游 mission kon-spl-dsl（已归档）为 SPL 引擎交付了基于 kunun Kon 语言的 DSL（`packages/kon-spl-dsl`，11 个 spl_* word + evaluateFlowSync）。当前产品使用面仍是 FlowCell 网格脚本：web-server 的 flow 执行 API 接收 FlowCell 表达式，web-ide 用 Univer 类 Excel 网格编辑，demos 与 E2E 全部基于网格。用户要求把 flow 部分与前端部分（含示例、测试）**改造切换**为基于 Kon 的新调用方式。

## 目标

- 证据盘点：web-server API 面、web-ide 页面/组件/demos/E2E 面、服务端 host Kon 的可行性（依赖方式、每请求隔离、错误与安全边界）。
- 设计收敛：定案 E1–E7（API 形态、host 方式、前端编辑形态、旧路径清退范围、demos 迁移清单）。
- 三批落地 track：
  1. 服务端 Kon 执行链路（kon-spl-dsl 门面 API + web-server 新端点 + 测试）；
  2. 前端切换（web-ide Kon 编辑主模式、demos 全部 Kon 化、E2E 改写）；
  3. 旧网格使用面清退（旧端点、网格页面、旧 demos/E2E）与总验证。
- 最终状态：从 web-ide 编辑并执行的是 Kon 脚本；示例与 E2E 全部基于 Kon；全仓测试与 E2E 通过。

## 非目标

- 不修改 kunun 仓库。
- 引擎层不做行为变更：`depa-data-spl-flow` 的 evaluateFlow/FlowCell、DataSet、expression 引擎保持原样（它们是引擎能力与 kon-spl-dsl 的依赖，"切换"只针对产品使用面）。
- 不做 Kon 语言的语法高亮/LSP 等编辑器深度功能（基础文本编辑 + 运行 + 结果展示即可；增强属后续 backlog）。
- mission 本身不直接改代码；落地由 track 承担。

## 为什么需要 mission 而不是单个 track

- 跨服务端、前端、测试三个面的切换，批间有依赖（先有服务端执行链路，前端才能切，最后才能清退旧路径）。
- 前端编辑形态（文本 vs 网格）与旧路径清退范围是需要 evidence 支撑的取舍（decision-tree E4/E5），执行期可能重规划。

## 成功判据

- web-ide 主路径编辑/执行 Kon 脚本，结果正确显示；demos 全部为 Kon 版且可加载运行。
- E2E（Playwright）全部基于 Kon 路径通过；全仓 bun test 通过。
- 旧网格使用面按 G2 定案清退完毕（或其保留决定有 replan 记录）；引擎层零行为回归。
- E1–E7 全部定案或显式 backlog；每个 track 回指 evidence。

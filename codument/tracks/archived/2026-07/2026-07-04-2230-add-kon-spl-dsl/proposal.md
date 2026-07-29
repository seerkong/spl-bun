# 变更：新增基于 kunun Kon 语言的 SPL 引擎封装调用方式（depa-data-kon-spl-dsl）

## 背景和动机 (Context And Why)

spl-bun 现有两种调用方式：TypeScript 库 API 与 FlowCell 网格脚本（类 Excel 交互）。kunun（`kunun.ts`）的 Kon 语法已承载 ai_* workflow DSL，其运行时提供 prefix keyword 注册扩展点。本变更为 SPL 引擎新增第三种调用方式：Kon 语言内的 `spl_*` word 集，让 Kon 脚本能以贴合 Kon 习惯的语法接入 SPL 的数据源与数据运算能力。语法设计遵守用户给定的 Kon knot 惯例（普通配置放 `:{}`、`#name` 命名、系统级元数据键值承载 SPL `@选项`）。

## "要做"和"不做" (Goals / Non-Goals)

**目标:**
- 新增 workspace package `depa-data-kon-spl-dsl`：`EnableSplDsl(runtime, splContext)` 注册 `spl_connect / spl_query / spl_execute / spl_eval / spl_flow` 五个 prefix keyword word。
- knot 读取约定：配置从 Conf(`:{}`)、命名从 Name(`#name`)、SPL `@选项` 从 Metadata(`#opt = 串`) 与 Attr 省值糖(`@x`)，沿 Next 链合并读取。
- `depa-data-spl-flow` 新增 `evaluateFlowSync`（同步数据源路径），供 `spl_flow` 兼容执行存量网格脚本。
- 对 kunun 的依赖走本 package tsconfig paths 映射 kunun 仓库 lib 源码（kunun 零改动）。
- bun 测试 + 示例 .kon 脚本端到端验证（与等价网格脚本结果一致）。

**非目标:**
- 不修改 kunun 仓库。
- 不接 workflow checkpoint/yield 异步分发；全同步执行。
- 不做 web-ide 集成、不做类型系统/注解深度集成。
- 高频数据运算的 Kon 原生 word（spl_select/spl_groups/...）留给后续 track `add-kon-spl-native-words`。

## 变更内容（What Changes）

- 新增 `packages/kon-spl-dsl/`（src/index.ts 单入口 capsule、context.ts、knot-reader.ts、options.ts、words/*、__tests__、独立 tsconfig 含 kunun paths、README 前置条件说明）。
- `packages/spl-flow` 新增导出 `evaluateFlowSync`（不改变 evaluateFlow 既有行为，非破坏性）。
- 根 workspace 无破坏性变更；新 package 不进入现有包的依赖图。

## 影响范围（Impact）

- 受影响的能力（behaviors）：新增 `kon-spl-dsl`（本 track behavior_deltas）。
- 受影响的代码：新增 `packages/kon-spl-dsl/**`；修改 `packages/spl-flow/src/index.ts`（新增同步入口）及其测试。
- 运行前置条件：本机存在 kunun 仓库且已 `bun install`（路径写在 kon-spl-dsl 的 tsconfig，README 说明）。

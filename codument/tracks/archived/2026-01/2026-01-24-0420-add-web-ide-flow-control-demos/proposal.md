# 变更：为 Web-IDE 添加 Flow-Control Demo（可直接体验运行）

## 背景和动机 (Context And Why)

`impl-flow-control` 已在 `packages/spl-flow` 中实现了 SPL(Java) 风格的流程控制能力（if/for/break/continue/goto/func/return/result/end/try）。

但目前 Web-IDE 的 demo 仍主要是表达式/数据处理示例，且 Run Sheet 只收集 A 列，导致这些流程控制能力无法在 UI 中以“可运行 demo”的方式直接体验与验证。

## “要做”和“不做” (Goals / Non-Goals)

**目标:**
- 在 Web-IDE demo 下拉列表中新增一组 flow-control demos，覆盖全部新增语句/场景。
- 允许 demo 使用多列缩进块（B/C/D...）表达 if/for/try/func 的 block，并让 Run Sheet 能把这些多列单元格一起发送到后端执行。
- 每个 demo 以可视化输出为导向：运行后通过 AG Grid 展示 `{columns, rows}` 汇总表。
- 增加 Playwright E2E smoke 覆盖，防止 demo 回归。

**非目标:**
- 不修改 `packages/spl-flow` 的语义/新增语句（本 track 只做“体验层”与 demo）。
- 不做复杂的 UI 改造（例如完整教程、可视化控制流图、调试器等）。

## 变更内容（What Changes）

- 在 `packages/web-ide/src/pages/SplIde.vue` 增加多条 flow-control demo 定义（分语句/分场景）。
- 调整 Web-IDE 的 Run Sheet 采集逻辑：从“仅 A 列”升级为“采集多列网格范围内的非空单元格”，以支持缩进块。
- 更新 `playwright.config.ts` / e2e 用例，对新增 demo 增加运行断言（Done + grid 内容）。

## 影响范围（Impact）

- 受影响的功能规范：Web-IDE demo 体验、flow-control 可运行性验证、E2E 覆盖。
- 受影响的模块/文件（预期）：
  - `packages/web-ide/src/pages/SplIde.vue`
  - `packages/web-ide/__tests__/e2e/*.e2e.ts`
  - （如需要）`packages/web-shared` 中的类型定义

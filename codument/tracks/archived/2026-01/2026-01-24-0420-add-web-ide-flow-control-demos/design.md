## 上下文

- `packages/spl-flow` 已实现 flow-control（if/for/break/continue/goto/func/return/result/end/try）。
- Web-IDE 当前 demo 主要为表达式/数据处理示例，缺少 flow-control 可运行 demo。
- Web-IDE 当前 Run Sheet 只采集 A 列（`collectColumnA()`），无法表达基于列缩进的 block（B/C/D...）。
- UI 的可视化输出主要依赖后端返回的 `lastQuery`，并用 AG Grid 展示 `{columns, rows}`。

## 方案概览

1. Demo 设计
  - 在 `packages/web-ide/src/pages/SplIde.vue` 的 `demos` 列表中新增一组 "Flow Control" demos。
  - 每个 demo 以“单一语句/场景”为主（separate demos），便于学习与回归定位。
  - 每个 demo 最终都构造一个 `{ columns, rows }` 汇总表作为最后输出，保证 AG Grid 可见。

2. 多列采集（关键能力）
  - 将 Web-IDE 的执行输入从“仅 A 列”升级为“采集固定区域内的非空单元格”。
  - 推荐固定区域与 demo 清理区域保持一致（例如 20 行 x 8 列 A..H），避免依赖 Univer 的 used-range API。
  - 采集时只发送非空字符串内容（trim 后非空）。
  - 发送 payload 仍为 `flowDef: {row, col, expr}[]`，后端无需改动。

3. E2E 覆盖
  - 在 `packages/web-ide/__tests__/e2e` 新增/扩展 e2e，用现有 helper：
    - 选择 demo
    - Run Sheet
    - 检查 status 为 Done
    - 检查 grid 包含预期行名

## 影响范围与修改点（Impact）

- `packages/web-ide/src/pages/SplIde.vue`
  - 新增 demos
  - 修改 Run Sheet 采集逻辑（从 collectColumnA → collectGridRange）
- `packages/web-ide/__tests__/e2e/*.e2e.ts`
  - 增加对新增 demo 的 smoke 覆盖
- （可选）`packages/web-shared`
  - 如果 ExecuteRequest/ExecuteResponse 需要补齐字段或类型适配

## 决策

- 决策：使用“固定区域采集”而非“全 sheet 扫描”。
  - 原因：`getMaxRows()` 可能很大；全量扫描影响性能。
  - demo 本身也会清理固定区域，因此固定范围足够。

## 风险 / 权衡

- 风险：用户手写的更大范围脚本可能不会被采集。
  - 缓解：该 track 目标是 demo 体验；范围可在后续 track 再扩展（例如 used-range 探测）。

## 兼容性设计

- 保持现有 demo 可运行：原先只写 A 列的 demo 在“多列采集”下仍会被采集并执行。
- 遵循 TS dialect：demo 保证每 row 只有一个可执行 cell；缩进通过列位置（B/C/D）表达。

## 迁移计划

1) 增加 demo definitions
2) 改造 Run Sheet 采集逻辑并确保旧 demo 不受影响
3) 增加 e2e coverage

## 待解决问题

- 固定采集区域的具体大小：默认建议 20x8（与当前 reset/loadDemo 清理一致），如需可在实现时调整为 30x10。

## 上下文
`spl-flow` 已支持 `=`/`>` 前缀的兼容解析，但目前 `>` 前缀仅被剥离并仍写入 `scope[cellRef]`。需要对齐 esProc/SPL 的执行格语义：执行但不赋值，同时保持执行记录与 `lastQuery` 行为。

## 方案概览
1. 解析层保留 execute-only 标记
  - 在 cell 分类中识别 `>` 前缀并记录为 `executeOnly` 标记。
2. 执行层跳过赋值
  - 在表达式执行路径中，当 `executeOnly` 为 true 时不写入 `scope[cellRef]`。
3. 保持执行记录与 `lastQuery`
  - 仍记录该 cell 的执行结果用于结果报告。
  - 若表达式返回查询结果，仍更新 `lastQuery`。
4. Web-IDE demo 与文档同步
  - 新增 execute-only 示例并补充说明。

## 影响范围与修改点（Impact）
- `packages/spl-flow/src/flow/grid.ts`: 保留 execute-only 前缀信息。
- `packages/spl-flow/src/index.ts`: 表达式执行时条件性写入 scope。
- `packages/spl-flow/__tests__`: 新增/更新测试。
- `packages/web-ide/src/pages/SplIde.vue`: 增加 demo。
- `doc/ai/modules/spl-flow/introduce/flow-control.md` 等文档（待确认）。

## 决策
- 决策：在 `FlowGridCell` 上新增 execute-only 标记，并在执行阶段统一处理赋值策略。
- 考虑的替代方案：在执行时再解析 `raw` 前缀。放弃该方案以避免重复解析并保持单一分类来源。

## 风险 / 权衡
- 风险：execute-only 不赋值可能影响依赖 `A1` 值的现有 demo。
  - 缓解：新增专用 demo，并确保旧 demo 不使用 `>` 前缀。

## 兼容性设计
- 现有不带前缀或带 `=` 前缀的表达式行为不变。
- `>` 前缀仅作用于表达式格，命令格不支持 `>` 前缀。

## 迁移计划
- 更新解析与执行逻辑 → 单元测试 → Web-IDE demo → 文档。

## 待解决问题
- 需确认文档具体落点（flow-control 文档或表达式文档）。

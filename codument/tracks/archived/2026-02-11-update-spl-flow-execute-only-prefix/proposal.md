# 变更：更新 spl-flow 执行前缀 '>' 语义

## 背景和动机 (Context And Why)
当前 spl-flow 对以 `>` 开头的表达式仅做前缀剥离，仍会把结果写入 `scope[cellRef]`。这与 esProc/SPL 的“执行格（>`statement`）无返回值”语义不一致，影响行为对齐与示例迁移。

## “要做”和“不做” (Goals / Non-Goals)
**目标:**
- 让 `>` 前缀表达式作为“执行格”执行，但不写入 `scope[cellRef]`。
- 仍记录执行结果（用于执行报告/调试），并允许更新 `lastQuery`。
- 增加测试用例覆盖 execute-only 行为。
- 在 Web-IDE demo 列表中增加 execute-only 示例，并更新相关文档。

**非目标:**
- 不改变命令格语义（if/for/try 等不新增 `>` 前缀形式）。
- 不引入新的表达式语法或改写 expression 引擎。
- 不调整现有流程控制指令集合。

## 变更内容（What Changes）
- `packages/spl-flow`：在 cell 分类中保留 execute-only 标记，并在执行表达式时跳过 `scope` 赋值。
- `packages/spl-flow`：保持执行报告记录结果，并在 execute-only 查询时更新 `lastQuery`。
- `packages/spl-flow/__tests__`：新增/更新单元测试覆盖 `>` 执行不赋值。
- `packages/web-ide`：新增一个 execute-only demo 条目。
- `doc/`：补充 execute-only 语义说明。

## 影响范围（Impact）
- 受影响的功能规范：flow-control 表达式前缀语义、Web-IDE demo 列表。
- 受影响的代码：
  - `packages/spl-flow/src/flow/grid.ts`
  - `packages/spl-flow/src/index.ts`
  - `packages/spl-flow/__tests__/grid.test.ts`
  - `packages/spl-flow/__tests__/dsl.test.ts`
  - `packages/web-ide/src/pages/SplIde.vue`
  - 相关文档文件（待确认）

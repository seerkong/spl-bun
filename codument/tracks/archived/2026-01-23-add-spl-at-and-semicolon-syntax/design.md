## 上下文

- 当前 TS 表达式解析器：
  - 函数调用参数只支持 `,` 分隔。
  - 不识别 `@`、`;` 作为语法 token。
- 当前 Excel `T()`（TS）为了表达 sheet/header 选项使用了对象参数：
  - `T(path, data, { sheet, header })`
  - 这与 Java SPL 风格不一致。

本 track 的目标是增加语法层兼容能力，让 TS 表达式能按 Java SPL 写法表达同样的意图。

## 方案概览

1. 解析器支持 `@` 与 `;`
  - `fn@opt(...)` / `obj.m@opt(...)`
  - `;` 分组：`fn(a,b; c,d)`

2. AST 扩展
  - 为 `call` 与 `member_call` 节点增加：
    - `option?: string`
    - `argGroups?: ExpressionNode[][]`
  - 兼容旧 AST：当没有 `;` 时，`argGroups` 为空/undefined，沿用 `args`。

3. 解释器/分发约定（关键决策）
  - 约定：`@opt` 会以“额外参数”方式传递给实现（最小侵入）：
    - 函数：`fn@opt(a,b)` 等价于 `fn(a,b,"opt")`
    - 成员：`obj.m@opt(a,b)` 等价于 `m(obj,a,b,"opt")`（即追加到 args 尾部）
  - 约定：存在 `;` 时，优先使用 `argGroups` 传递结构化参数。
    - 对于需要 Java SPL 语义的函数（例如 `T`），实现读取 `argGroups` 而不是仅靠扁平 args。
    - 对于一般函数，可将 `argGroups` 扁平化为 args（保持与 `,` 一致）。

4. Excel `T()` 迁移与新语义
  - Java 风格：
    - 写：`T(path, data; sheet)`
    - 读：`T(path; sheet)`
  - `@b`：无标题行（header=false）
  - 默认有标题行（header=true）

## 影响范围与修改点（Impact）

- `packages/expression/src/parser.ts`
  - tokenizer 增加 `@` `;`
  - call/member_call 参数解析支持 `;` 分组
  - call/member_call 解析支持 `@opt`

- `packages/expression/src/ast.ts`
  - 扩展节点结构以携带 `option` 与 `argGroups`

- `packages/expression/src/evaluator.ts`
  - 分发 call/member_call 时将 option 与 groups 传递给实现

- `packages/spl-flow/src/index.ts`
  - `T()` 改为读取 `;` sheet 参数与 `@b/@c` 选项
  - 移除 options-object 形式

- 全仓库迁移（tests/demos/docs）
  - 将 `T("...xlsx", data, { sheet: "S1", header: true })` 改为 `T@t("...xlsx", data; "S1")` 或默认标题时省略 `@t`

## 决策

- 决策：`@opt` 作为 options 字符串追加到调用参数末尾
  - 为什么：最小化对现有 FunctionRegistry/MemberRegistry 的侵入，避免为每个组合注册新名字。

- 决策：`;` 解析为 argument groups
  - 为什么：贴近 Java IParam.Semicolon 的分组语义，避免把 `;` 退化为 `,` 造成语义不可区分。

## 风险 / 权衡

- 语法改动是 **BREAKING**：可能影响已有表达式。
- 需要清晰的错误信息来指导迁移。
- 全仓库迁移需要自动化检查以避免遗漏。

## 兼容性设计

本 track 按用户要求：不兼容旧 Excel options-object 写法。

（对非 Excel 的调用语法，仍保留原本仅 `,` 的写法；新增 `;` 与 `@` 不会破坏不使用它们的表达式。）

## 待解决问题

- `@c` cursor 语义在 TS 侧是否需要补齐（Excel/xlsx-only）。若不补齐，应给出明确报错并在 spec 中标注。

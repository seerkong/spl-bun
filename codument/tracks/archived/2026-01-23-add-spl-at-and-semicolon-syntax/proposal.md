# 变更：对齐 SPL(Java) 语法（@ 变种 + ; 分组参数）

## 背景和动机 (Context And Why)
当前 TypeScript 解释器的调用语法与 Java 版 SPL 不一致：
- 不支持 `fn@opt(...)` / `obj.m@opt(...)` 的“变种/选项”语法。
- 调用参数列表不支持 `;` 分组（Java SPL 中广泛用于例如 `T(path, A; s)` 这类场景）。

这导致 Web IDE demo、测试用例、以及 Excel 相关能力的表达方式与 Java SPL 文档/用户习惯不一致，迁移与对照成本较高。

## “要做”和“不做” (Goals / Non-Goals)
**目标:**
- 支持 `@` 语法：函数与成员调用都可以使用 `@` 指定变种/选项（如 `T@c(...)`、`file(...).xlsimport@t(...)`）。
- 支持 `;` 参数分组：在函数/成员调用括号内支持 `;` 分组，组内仍使用 `,`。
- 将仓库内所有 Excel `T()` 用法迁移到 Java 风格：`T(path, data; sheet)` / `T(path; sheet)`。
- 移除 TS-only 的 Excel `T(path, data, { sheet, header })` 风格（只保留新语法）。

**非目标:**
- 不在本 track 内补齐所有 Java SPL 功能差异（仅聚焦语法兼容层）。
- 不承诺一次性实现 Excel 的所有 `@` 选项（例如 `@c` 的 cursor 语义若不具备实现条件，可先明确报错）。

## 变更内容（What Changes）
- **BREAKING**：移除 Excel `T()` 的 options-object 调用方式，改为 Java 风格 `;` + `@`。
- 解析器/AST 扩展：支持 `@` 与 `;`。
- 解释器/分发逻辑扩展：将 `@opt` 信息交给运行时函数/成员方法。
- 全仓库迁移：更新 Web-IDE demo、测试、文档等所有 Excel `T()` 调用。

## 影响范围（Impact）
- 受影响的功能规范：表达式语法、Excel T()。
- 受影响的代码：
  - `packages/expression/src/parser.ts`
  - `packages/expression/src/ast.ts`
  - `packages/expression/src/evaluator.ts`
  - `packages/expression/src/memberRegistry.ts`
  - `packages/spl-flow/src/index.ts` (T)
  - Web IDE demos/tests and any docs containing Excel T() calls

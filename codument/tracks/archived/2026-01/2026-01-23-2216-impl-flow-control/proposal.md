# 变更：实现 SPL(Java) 的流程控制（TypeScript / spl-flow）

## 背景和动机 (Context And Why)
当前 `packages/spl-flow` 只支持按顺序执行表达式单元格（把单元格内容交给 `depa-data-expression` 求值），缺少 SPL(Java) 里最关键的脚本级流程控制：`if/for/break/continue/goto/func/return/try` 等。

这导致：
- Web-IDE 无法表达和运行更接近真实 SPL 的脚本逻辑。
- Java 版 SPL 的示例/文档无法直接迁移或对照验证。

## “要做”和“不做” (Goals / Non-Goals)
**目标:**
- 在 TypeScript 运行时实现 SPL(Java) 的核心流程控制语句（以 Java 支持的语义为准）。
- 主要实现放在 `packages/spl-flow`；表达式级别的能力仅在 Java 确实由 expression 引擎承担时，才落到 `packages/expression`。
- 兼容当前 Web-IDE 的输入习惯：表达式不要求前缀 `=`（但可兼容接受 `=`）。
- TypeScript 方言差异：除注释格外，每行（row）最多一个可执行格；仅 `//` 开头为注释格，且注释格右侧同一行内容被忽略（行内注释）；循环继续使用 `continue` 关键字（不支持 `next`）。

**非目标:**
- 不实现 `fork/reduce/channel`（本 track 明确不做并发相关语义）。
- 不尝试一次性实现所有 Java SPL 的边缘语义（例如宏模式 func@m、分布式 fork 等）。
- 不引入新的外部依赖来“重写一套语言”，尽量复用现有 expression evaluator。

## 变更内容（What Changes）
- `packages/spl-flow`：从“线性顺序执行”升级为“网格（row/col）+ 缩进块 + 执行栈”的执行模型。
- 新增/扩展：
  - 语句识别与解析（command cells）
  - if/elseif/else
- for（整数/范围/序列/while）
- break/continue（支持可选目标 cellRef）
  - goto（带安全约束）
  - func/return/result/end
  - try（捕获错误并把错误信息存入 try 单元格）
- 视需要在 `packages/expression` 做小幅补齐（仅限 Java expression 语义对应项）。

## 影响范围（Impact）
- 受影响的功能规范：新增“flow-control”能力规范（本 track spec.md）。
- 受影响的代码：
  - `packages/spl-flow/src/index.ts`（evaluateFlow 执行模型会发生显著变化）
  - 可能新增 `packages/spl-flow/src/flow/*`（拆分解析与执行逻辑）
  - 可能小幅修改 `packages/expression`（仅当必要）
- 受影响的上游：
  - `packages/web-server/src/server.ts`（返回值/错误处理可能需要对齐 result/end 语义）
  - `packages/web-ide`（现阶段仅采集 A 列；多列缩进能力可后续逐步接入）

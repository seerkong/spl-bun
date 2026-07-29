# Mission：kon-spl-dsl —— 基于 Kon 语言的 SPL 引擎封装调用方式

## 背景和动机

spl-bun 是 esProc 核心引擎的 TypeScript 重实现：SPL 表达式引擎（`depa-data-expression`）、数据集运算（`depa-data-core`）、网格式 flow 执行（`depa-data-spl-flow` 的 `evaluateFlow`，A1 单元格 + 列缩进代码块 + `if/for/goto/result` 命令）。现有调用方式有两种：TypeScript 库 API 与网格 FlowCell 脚本（面向类 Excel 交互）。

kunun（`kunun.ts`）是一门 lisp+forth 风格的自制语言，其 Kon 语法（`(word #name :key = value :[body])`）已承载一套 ai_* 动态 workflow DSL（`packages/workflow-dsl`），且运行时提供成熟的语言内 DSL 扩展点：`registerPrefixKeyword` / `registerWorkflowExtension` / `registerHostFunction`，无需修改 parser 即可注册新 word 集。

本 mission 的目标：参考现有 SPL 网格脚本与底层引擎能力，在 spl-bun 中新增一套**基于 Kon 语言的封装后调用方式**（`spl_*` word 集，语言内 DSL），新语法尽量利用 Kon 的语言特性与习惯，而非机械翻译 SPL 网格模型。语法设计遵守 Kon knot 惯例（用户约束 U1）：`#name` 命名、**普通配置放 `:{}`（Conf）**、块用 `:[...]`（Body）、根层级 `:tag = value` 具名槽位属系统级/结构性用途不用于普通配置；并利用 knot 的系统级元数据键值语法（`#key = value`、省值形态）承载 SPL 的 `func_name@sub_name` 函数选项（用户约束 U2，kunun 解释器暂无此能力，由 DSL 展开层实现）。

## 目标

- 完成两侧证据盘点：spl-bun 引擎公开 API 面（表达式/DataSet/flow 执行上下文/数据源），kunun 扩展点与 Kon 语法细节，并验证 spl-bun 以 bun 依赖方式引用 kunun 包的可行性。
- 完成设计收敛：定案集成方向（D1）、封装层级（D2，倾向「控制流用 Kon 自身、SPL 负责数据运算与数据源」的混合方案）、SPL 表达式嵌入方式（D3，先字符串透传后原生 word 分两批）；产出 `spl_*` word 集语法草案与示例 Kon 脚本。
- 首批落地 track：新增 Kon↔SPL 桥接包（暂名 `depa-data-kon-spl-dsl`），注册 `spl_*` word（数据源连接/查询、`spl_eval` 表达式透传、DataSet 结果在 Kon 作用域中流转、兼容执行存量网格脚本的 `spl_flow`），含测试与示例。
- 第二批落地 track：为高频数据运算（select/groups/join/sort/derive/窗口等）设计并实现 Kon 原生 word，把 SPL 的 `: , ; @` 参数结构映射为 Kon 习惯写法。
- 最终验证：示例 Kon 脚本可端到端跑通（含 SQLite/CSV 数据源），与等价 SPL 网格脚本结果一致。

## 非目标

- mission 本身不直接改代码；代码、测试、规范由各 track 承担。
- 不修改 kunun 仓库（若发现扩展 API 缺口，作为 evidence 记录后另议）。
- 首批不做 web-ide 的 Kon 编辑交互（D5）、不接入 workflow checkpoint/yield 异步分发（D4）、不做类型系统/注解深度集成（D6，仅在设计上预留兼容）。
- 不追求 SPL 语法全量 Kon 原生化；表达式透传层保证全功能即可。

## 为什么需要 mission 而不是单个 track

- 跨两个仓库的知识面（spl-bun 引擎 + kunun 语言运行时），需要先证据盘点与依赖可行性验证。
- 语法设计存在多个未收口的取舍（decision-tree D1–D6），需要设计收敛阶段再切片。
- 落地分至少两批 track（桥接包 → 原生 word 集），批间有依赖且第二批切片依赖第一批的使用反馈，执行期可能重规划。

## 成功判据

- 每个落地 track 能回指 G1 盘点 evidence 与 G2 设计定案。
- 存在可运行的示例 Kon 脚本：连接数据源 → SPL 查询/运算 → Kon 控制流组合 → 输出结果，测试通过。
- decision-tree 中 D1–D6 全部标注定案或显式移入 backlog。
- 所有 mission 节点 DONE 或 SUPERSEDED，最终 verify 报告确认目标收敛。

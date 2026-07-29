# Decisions · kon-spl-dsl

> 决策真源。规划期（severity=light）以假设 + 保守默认推进，状态 `assumed` 的条目须在 G2 设计收敛时以 evidence 确认或推翻（推翻走受控重规划）。详细推理见 `analysis/decision-tree.md`。

| ID | 决策 | 状态 | 内容 | 依据 |
|----|------|------|------|------|
| D1 | 集成方向与依赖方式 | decided | spl-bun 新增 `depa-data-kon-spl-dsl`（暂名）依赖 kunun 包；kunun 零改动；依赖单向 | kunun 扩展点全在 runtime 注册层，无需改 parser；DEPA 单向依赖不变量 |
| D2 | 封装层级 | decided | 混合：控制流用 Kon 自身；数据运算/数据源经 spl_* word；`spl_flow` 兼容执行存量网格脚本 | Kon 已有 var/if/foreach，复刻网格 goto 模型无增量价值；SPL 价值在数据运算 |
| D3 | SPL 表达式嵌入 | decided | 分层：第一批字符串透传（spl_eval/spl_query），第二批高频运算 Kon 原生 word | 透传层复用完备的表达式引擎保证全功能；原生层控制学习成本 |
| D4 | workflow checkpoint/yield 接入 | deferred | 首批不做，记 backlog | spl 查询同步；无长任务分发需求 evidence |
| D5 | web-ide Kon 交互 | deferred | 首批不做 | 引擎层先行；UI 集成另起 track/mission |
| D6 | 类型/注解集成 | deferred | 首批不做，Conf/Metadata/Attr 用法与 AnnotationExtractor 注解源约定预留兼容 | row type 描述 DataSet schema 属增强，不阻塞主链路 |
| D7 | SPL `func@sub` 选项的 Kon 表达 | decided | 用 knot 系统级元数据键值语法（`#key = value`，善用省值形态）承载 SPL `@选项`；DSL 展开器读 knot.Metadata（辅以 Attr）拼 SPL 表达式串，kunun 解释器零改动；具体书写约定待 G1-T3 parser 实测（`#tag` 省值现落 Name）后 G2 定案 | 用户输入 U2；depa-data-expression 原生支持 `@选项` |
| U1 | 配置槽位惯例 | confirmed | 普通键值配置放 `:{}`（Conf）；根层级 `:tag = value` 具名槽位（NamedConf/Sections/Slots/NamedProp）属系统级/结构性用途不用于普通配置；命名用 `#name`、块用 `:[...]` | 用户输入 U1 + parser 精读 |
| A2 | word 前缀与命名 | decided | 前缀 `spl_`；`#name` 用作结果命名（对应网格 A1 可引用中间结果的心智）；配置遵 U1 进 `:{}` | 与 ai_* 命名习惯一致 |
| A3 | 运行入口 | assumed | 首批库 API `EnableSplDsl(runtime, splContext)` + bun 测试；不新建 CLI | 最小可验证面 |

> 2026-07-04 G2 收敛：D1（tsconfig paths 方案 c）、D2、D3、D7（`#opt = 串` 权威 + `@x` 省值糖 + Next 链合并读取）、A2 定案，依据 analysis/spl-kon-dsl-design.md 与 G1 三份 evidence；D4 修订为「全同步执行 + spl-flow 增加 evaluateFlowSync」（G1-T2 async 边界实测）。

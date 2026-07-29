# Mission Design · kon-spl-dsl

## 控制论模型

- **desired state**：mission.xml 顶层 TaskGroup DAG（G1 证据盘点 → G2 设计收敛 → G3 首批落地 → G4 原生 word 落地与总验证）、节点状态、叶子 Task 上的 `cdt:TrackLink`。
- **actual state**：mission 目录文件、`codument/tracks/` 与 archive 状态、bun 测试结果、`analysis/`、`reports/`、用户新约束。
- **actuation**：创建/续跑/归档 track，或依 evidence 受控修订 mission.xml（递增 Revision + `reports/replan-XXX.md`）。
- **feedback / drift**：G1 盘点推翻假设（如 bun 无法 link kunun 包）、G3 使用反馈改变 G4 切片、测试失败、用户介入。

## Mission Actors

| Actor | 控制论角色 | DEPA 归属 | 职责 |
|---|---|---|---|
| `MissionPlanner` | 期望态产出者 | Processor + Actor | 产出/修订 desired mission graph（本文件 + mission.xml）与 decision frontier |
| `MissionObserver` | 传感器 | Data + Actor | 读取 tracks/archive/测试/reports/两仓库代码，投影 actual state |
| `MissionReconciler` | 控制器 | Processor + Actor | 比较 desired vs actual，判定 drift / ready / blocked / done，识别被 pending decision（D1–D6）阻塞的节点 |
| `MissionApplier` | 执行器 | Effect + Actor | 执行一个 bounded action：创建/推进 track、写报告、（light 模式下必要时）一次有界提问 |

## plan 与 track 的区分

- mission 只负责控制面：盘点、设计收敛、切片、验证、重规划；产物是 `analysis/`、`reports/`、决策记录。
- 代码/测试/规范落地由真实 track 承担：G3-T1（`add-kon-spl-dsl`）与 G4-T1（`add-kon-spl-native-words`）是仅有的 TrackLink 节点。
- 无「不经 track 的直接实现」例外。

## 技术方向摘要（供 G2 收敛的起点，非定案）

依据 `analysis/decision-tree.md`（D1–D7 假设，含用户权威约束 U1/U2）：

0. **Kon knot 语法基线**（U1，修正首轮误读）：knot 内首个普通值是 `Core`（被调 word）；`#tag` 省值 → `Name`；`#tag = value` → `Metadata`（系统级元数据键值）；`@tag`（可省值）→ `Attr`；**普通键值配置放 `:{}` → `Conf`**；`:[...]` → `Body`；根层级 `:tag = {..}/[..]/(..)/<..>` 分别落 `NamedConf/Sections/Slots/NamedProp` 具名槽位，属系统级/结构性用途，不用于普通配置。spl_* word 的语法设计必须遵守该惯例：配置进 `:{}`，命名用 `#name`，块用 `:[...]`，具名槽位仅在结构性声明确有必要时逐个论证。
1. **依赖方向**（D1）：spl-bun 新增 package `depa-data-kon-spl-dsl`，依赖 kunun 的 runtime/converter/core 包（本地路径依赖，G1-T2 验证）；kunun 零改动。符合 DEPA 单向无环依赖不变量。
2. **封装层级**（D2，混合方案）：
   - 控制流交给 Kon 自身（`var/set/if/foreach/break`），不复刻 SPL 网格的 A1/goto/列缩进模型；
   - SPL 的核心价值——数据源接入与数据集运算——经 `registerPrefixKeyword` / `registerHostFunction` 暴露为 `spl_*` word（prefix keyword 展开器拿到完整 knot，可读取 Core/Name/Metadata/Attr/Conf/Body 全部字段）；
   - `spl_flow` word 允许整体执行存量 FlowCell 网格脚本（复用 `evaluateFlow`），做兼容与迁移通道。
3. **表达式嵌入**（D3，分两批）：
   - 第一批 `spl_eval` / `spl_query` 字符串透传，直达 `depa-data-expression` 的 `compileExpression` 与 spl-flow 的执行上下文（scope、连接、数据源、workspaceRoot 沙箱）；
   - 第二批为高频运算设计 Kon 原生 word——参考映射：SPL `;` 角色分组 → Conf 内不同键（`:{keys = [...] agg = {...}}`）；SPL `:` 配对 → Kon map `{alias = expr}`；示例形态（配置全部走 Conf）：`(spl_groups #byState :{in = t keys = [STATEID] agg = {Population = "sum(POPULATION)"}})`。
   - DataSet 值直接在 Kon 作用域流转（Kon 变量持有 DataSet 引用，host function 消费）。
4. **SPL `@选项` 的表达**（D7 / U2）：kunun 解释器暂无 `func_name@sub_name` 调用能力，DSL 层利用 knot 的**系统级元数据键值语法**（`#key = value`，善用省值形态）承载 SPL `@选项`——展开器从 `knot.Metadata`（辅以 `Attr`）读出选项，拼接成 SPL 表达式串（如 `interval@y`）交给表达式引擎（该引擎原生支持 `@选项`），kunun 零改动。当前 parser 中 `#tag` 省值会落 `Name` 而非 `Metadata`、重复 `#` 标签行为未验证——G1-T3 用 parser 实测定形，G2 定案具体书写约定。
5. **DSL 注册形态**：仿 `EnableWorkflowDsl(runtime)`，提供 `EnableSplDsl(runtime, splContext)`；`splContext` 封装 `FlowExecutionContext`（连接注册表、数据源工厂、workspaceRoot），作为 runtime 载体注入，逻辑保持 `fn(runtime, input, config)` 纯函数形态。
6. **预留**（D6）：word 的 Conf/Metadata/Attr 用法与 kunun `type-annotations` 的 `AnnotationExtractor` 注解源约定兼容，未来可用 row type 描述 DataSet schema、`#(...)` 标记做数据源注解。

## 受控重规划

active 后允许增删改节点与 DAG，但必须有 evidence（盘点报告、测试失败、track 反馈）或 human decision，写 `reports/replan-XXX.md` 并递增 `Metadata.Revision`。预期的重规划触发点：

- G1-T2 发现 bun 依赖 kunun 不可行 → D1 改走 vendor 或 kunun 发包，修订 G3 track 范围。
- G3 完成后使用反馈改变 G4 原生 word 清单/优先级 → 修订 G4-T1 的 track 范围或拆分。

## 人工介入

- severity=light：仅 P0 意图/不可逆取舍提问（如 D1 全部候选都被证据否决时）。
- G2-T2（首批 track 切片确认）与 G4 之后的总验证是自然的人工检查点；其余节点自主推进。

## 风险

| 风险 | 影响 | 缓解 |
|---|---|---|
| bun workspace 引用外部本地仓库包的解析问题（tsconfig paths / node_modules 链接） | 阻塞 G3 | G1-T2 先做最小 spike 验证；备选 vendor/发包 |
| Kon 运行时同步执行模型与 SPL 数据源 IO（sqlite 同步绑定 vs 异步 adapter）不匹配 | word 实现复杂化 | G1-T1 盘点 spl-flow 的同步/异步边界；首批限定同步数据源（sqlite/csv/json 本地） |
| SPL `: , ; @` 语义映射到 Kon 后心智不一致，用户学两套语法 | 采纳度低 | D3 分层：透传层保真，原生层只做高频且映射自然的运算；G2 草案附对照表 |
| kunun 仓库仍在演进，扩展 API 变动 | 桥接包脆弱 | 桥接包内做薄适配层（capsule 单入口），锁定依赖版本/commit |

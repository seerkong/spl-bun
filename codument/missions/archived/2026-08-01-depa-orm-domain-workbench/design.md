# Mission Design: depa-orm domain workbench

## 控制目标

- **desired state**：`mission.xml` 中 G1-G9 + correction DAG、一个历史 ontology TrackLink、一个 FS-native authority correction TrackLink、六个 host TrackLink、按证据插入的 external library corrections、本文及 `design/` 中的架构不变量，以及 `proposal.md` 的成功判据。
- **actual state**：mission/track 状态、host 与 `depa-orm` 公共 API、package boundary tests、runtime/HTTP/browser tests、执行 observations、reports 和用户新增约束。
- **actuation**：创建、执行、验证和归档真实 track；在有 evidence 或 human decision 时修订 mission DAG；对 unsupported capability 返回结构化 diagnostics。
- **feedback / drift**：public API 能力审计、track 验证、跨包依赖检查、请求隔离测试、代表性 operation matrix、Playwright 和最终独立 verify。

Mission 的标准 Actor 协议以 `codument/std/spec/mission-xml-spec.md` 为准；本 mission 的具体 actor/project 绑定已 materialize 在 `mission.xml`。

## 架构结论

1. 每个 `DomainContextBundle` 是一个可运行的 bounded domain context；Kon/modelSources 与 operation catalog 是只读定义真源，seed 是重建输入，SQLite 是单次执行期间的 live authority，所有结果视图都是只读投影。
2. Operation 不使用持续膨胀的 `kind` 枚举，而使用五个正交维度：
   - `owner`：domain-context、business-object、association、lifecycle、constraint、business-process、capability、raw；
   - `behavior`：action、mutation、query、transition、validate、computed、composed、raw；
   - `subject`：none、single、selection；
   - `invocation`：single、batch；
   - `effect`：read-only、write、mixed。
   - atomicity 不是 identity 或 effect 的子值：definition 声明 requestable set，binding 声明 actual set，server 投影 current set，request 为本次执行选择一个值。
3. `selection` 说明一个 invocation 的逻辑主语集合，selector 可为 all、filter 或 ids；`batch` 说明一个 request 中有多个相互独立、各有 subject/verb/payload/result/error 的 invocation。
4. HTTP DTO 在通用 contract capsule 中定义。运行时把 DTO 归一化为稳定 `targets` 与不可变 `invocation`，核心边界遵守 `fn(runtime, targets, invocation, config)`；浏览器对象和 transport 细节不得穿透。
5. 动态执行按 `operation.ref -> handler` registry 分发。五维是声明、校验、筛选和能力协商信息，不生成笛卡尔积 switch。
6. 每次执行必须完整走 `create -> initialize -> seed -> execute -> observe -> destroy`。现有 SPL `/api/execute-kon` 的 shared DTO 和 fresh Kon runtime 模式可参考，但应用级共享 SQLite 生命周期不能复制。
7. 只能依赖 `depa-orm` 的公开 package 入口。atomic batch/composed operation、逐项映射和 SQL trace 必须先过 capability gate；跨 datasource atomic 直接拒绝，不能静默降级。
8. `ontology-exchange-xml-standard` 是 latest-only 定义超集的当前 authority：Type/Relation/Rule/Lifecycle 内核独立拥有底层事实，BusinessObject 等上层 profile 只引用底层声明，Operation catalog 再引用 profile 与类型。host runtime 不因此变成任意 XML 执行引擎。
9. `OperationPresetDto.request` 是完整且唯一的 `ExecuteOperationRequest v1` authority；Operation definition 额外拥有静态 `verb` 与 requestable capability set。RuntimeBinding 与 server capability projection 不得回写或替代 definition，runtime 只计算交集并验证 request choice。

## 详细设计索引

- [Domain Context Bundle](design/domain-context-bundle.md)：bundle 组成、事实源、执行生命周期和只读策略。
- [Operation Model](design/operation-model.md)：五维模型、selection/batch 边界、DEPA 映射和覆盖矩阵。
- [HTTP Contract](design/http-contract.md)：catalog/execute API、single/batch request、response 与 capability diagnostics。
- [Runtime And Workbench](design/runtime-and-workbench.md)：capsule 依赖、`depa-orm` 适配、server/UI 和验证。
- [Operation Examples](design/operation-examples.md)：BO、selection、batch、association、lifecycle、constraint、process、capability 与 raw 示例。
- [Alignment And Evidence](design/alignment-and-evidence.md)：当前 workspace 与兄弟项目证据、可借鉴点和明确差异。
- [Ontology XML Superset](design/ontology-xml-superset.md)：latest-only grammar、底层内核/上层 profile 分层、v5 概念投影和 Operation 定义边界。

## Plan 与 Track

Mission 只承担控制面：

- 读取和冻结 evidence；
- 审计 public capability；
- 选择 ready track；
- 比较目标与实现、触发验证或 replan；
- 编排跨 track 依赖并做最终验收。

代码、行为规范、测试和文档落地全部由真实 track 承担，没有“不经 track 直接实现”的例外。历史 external definition、FS-native authority correction 与六个 host track 的依赖为：

```text
evidence
  -> depa-orm capability audit
  -> contracts
  -> ontology XML superset
  -> preset/request contract alignment
  -> runtime
  -> server --------\
  -> bundles --------> IDE
  -> FS-native ontology authority correction
                       -> final verify
```

若 capability audit 证明必须修改 `depa-orm`，G2 写 evidence 并受控插入 external track；host runtime 在该 track 完成前不得假装拥有相关能力。

## 受控重规划

active mission 可以增删改节点或依赖，但必须同时满足：

1. trigger 来自代码/API/test evidence 或用户 decision；
2. 写入 `reports/replan-XXX.md`，说明 actual state、desired state、diff、decision 和 applied change；
3. `Metadata.Revision` 与 `UpdatedAt` 更新；
4. 受影响的候选 TrackLink、成功判据和设计索引保持一致。

预期 replan 触发点：

- `depa-orm` 公开 API 无法在一个事务中执行已确认的 composed atomic semantics；
- storage capability 不提供逐项映射或可观测 SQL，response contract 需要降级为 diagnostics；
- selection 无法在不泄漏 query internals 的前提下稳定归一化；
- representative bundle 暴露新的 owner/behavior，但能用现有五维表达时只新增 catalog entry，不能扩张为新顶层 kind；
- browser 验证表明当前页面分区不能清晰展示 request、outcome、changes 和 trace；
- 用户改变 v1 的只读 Kon 或 fresh DB 决策。

## 人工介入

`QuestionSeverity=light`。已接受的产品和架构决策不重复询问。只有以下情况返回用户：

- 出现会改变目标含义的新 pending decision；
- external project 缺少 session binding 且直接阻断 ready 节点；
- public capability 与用户要求产生无法由 adapter 解决的冲突；
- 需要扩大到持久 session、在线编译、任意代码执行或跨 datasource atomic；
- 真实 BLOCKED、mission 终态或达到十条 linked-track checkpoint。

## 主要风险

| 风险 | 影响 | 控制措施 |
| --- | --- | --- |
| 把 Operation 再次收缩成 BO Action | 无法表达 Mutation、raw、process、association 等操作 | 五维模型和 representative matrix 作为 contract acceptance |
| 把 selection 与 batch 混为一谈 | 请求语义、结果和错误模型不稳定 | discriminated union、独立示例和 runtime normalization tests |
| preset、definition、binding 与 server 各自重建请求或能力真值 | Preview 无法原样执行，capability gate 会产生隐藏默认 | 完整 request preset；definition/binding/server/request 四层 authority；交集验证 |
| 误用现有 shared DB 生命周期 | 请求间状态泄漏，结果不可复现 | 六阶段 lifecycle、并发/重复执行隔离测试 |
| 宣称不存在的 atomic/SQL/batch 能力 | API 语义失真 | G2 capability gate、显式 diagnostics、禁止 silent downgrade |
| contract 落入 SPL 专属 package | 未来其他 runtime 无法复用 | 独立 `depa-data-domain-operation-contracts` capsule |
| 五维变成巨大 switch | 扩展成本和耦合持续上升 | operation-ref registry，维度只做声明/校验/筛选 |
| 上层 profile 重复拥有类型、关系、规则或生命周期结构 | 类型系统表达上限被 BO-first 语法锁死并产生双重真源 | validator 强制 lower-kernel authority；profile 只能使用稳定引用 |
| definition grammar 穿透 host runtime | 工作台变成任意 XML/代码执行入口 | XML 只拥有定义；runtime 只接受预注册 binding 和 transport-neutral contract |
| 通过预设注入任意代码 | 安全和可重复性失控 | bundle 编译期注册 handler，HTTP 只接受数据 DTO |

## 决策入口

所有已接受决策及后续执行期决策统一记录在 `decisions.xnl`。当前没有待确认 decision；`analysis/decision-tree.xnl` 记录本次规划的拓扑与保守假设。

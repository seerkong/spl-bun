# Runtime And Workbench

## Capsule 依赖方向

```text
depa-data-domain-operation-contracts
  <- depa-data-depa-orm-domain-runtime
  <- depa-data-domain-context-bundles
  <- packages/web-server composition
  <- packages/web-ide projection
```

更准确地说，server 同时依赖 contracts、runtime 和 bundle registry；IDE 依赖 contracts 和 HTTP API。依赖必须单向无环：

- contract 不依赖 runtime 或 web；
- transport-neutral normalization/validation 不依赖 Elysia；
- SQLite effect 和 `depa-orm` assembly 留在 runtime impl；
- server 只做 catalog routing、request lifecycle 和 response transport；
- IDE 只发送 command、展示 projection，不直接持有数据库事实。

`packages/depa-orm-capsule` 是 acceptance/evidence capsule，不是 production runtime package。实现只能从 `depa-orm-engine-contract`、`depa-orm-engine-logic`、`depa-orm-engine-assemble`、`depa-orm-engine-support-sqlite` 和 `depa-orm-dsl-kon` 的公开入口导入。

## Depa ORM 映射

当前公开主链：

```text
Kon source
  -> depa-orm-dsl-kon
  -> OrmEntitySchema / OrmRelationSchema
  -> depa-orm-engine-logic planning
  -> depa-orm-engine-assemble Reader / Writer
  -> injected SQLite storage/effects
```

Operation adapter 的初始映射：

| Operation | depa-orm 映射 |
| --- | --- |
| raw/BO query | public Reader + HTTP query DTO adapter |
| BO Mutation | one or more validated public `WriteMutation` calls |
| selection Mutation | selector resolution + mutation planning，语义由 handler 决定 |
| Association Mutation | FK、join table 或 relation write policy，由 compiled relation schema 驱动 |
| Action | registered handler 组合 query、Mutation 和业务检查，保留 child trace |
| Lifecycle Transition | state guard + Mutation，在 commit boundary 复验 |
| Constraint Validate | public schema/logic validation 或 registered pure validator |
| BusinessProcess/Capability Composed | operation plan，child nodes 逐个调用 registry |
| raw analytics | registered query handler，输出 graph/tree/table |

HTTP query DTO 不能直接暴露 immutable `SelectQuery` class 或内部 AST。adapter 负责从 JSON DTO 构造公开 query value。

Bundle authoring catalog 只拥有静态 model/resources/Operation definitions/presets，不把 server 当前 capability projection 固化为 bundle 真值。每个 `DomainOperationBinding` 显式声明 actual capability set；server composition 把 current capability projection 注入 runtime。有效能力是：

```text
definition requestable
  ∩ binding actual
  ∩ server current
```

request 的 `execution` 必须落在交集内。loader 使用 contract package 的 exact parser 与 preset/catalog matcher 验证并冻结完整 `preset.request`，不拆解、不重建，也不把 server projection 写回 bundle。

## Public Capability Audit

G2 在任何 runtime track 前输出 capability matrix，至少回答：

| 能力 | 必须查证 |
| --- | --- |
| single mutation transaction | 公开 Writer/transaction coordinator 的保证 |
| multiple mutations atomic | 是否存在公开 unit-of-work；不存在时是否需要 external track |
| batch item mapping | storage capability 与 Writer outcome 是否能稳定回指 item |
| selection update | public query/write 能否表达，还是 handler 需要先读后写 |
| nested relation mutation | relation schema 与 write policy 的支持边界 |
| SQL trace | 是否有公开 effect/plan hook，不得 import compiler internals |
| cleanup | SQLite connection、temp file 和 failed seed 的可证明清理 |

已知保守基线：

- 当前公开 mutation pipeline 以单个 `WriteMutation` 为基本单位；
- SQLite 可声明 atomic transaction，但 `batchResultMapping` 可能为 `none`；
- 因此 v1 不预先承诺跨 mutation atomic 和逐项 mapping。

若 host adapter 无法满足已经确认的同 datasource atomic composed semantics，MissionPlanner 才新增一个 `depa-orm` external track，并使用完整 library actor set。跨 datasource atomic 不进入 external track，直接保持非目标并由 API 拒绝。

### G2 Capability Audit Resolution

实际 public API 证据已经收敛：

- 同 datasource 的多个 public Writer 调用可以由 host adapter 包在一个 public outer transaction 中，并在失败时整体回滚；
- host 可以按 invocation 保留每次 Writer 返回值，但 SQLite 的 row-level `batchResultMapping` 仍为 `none`；
- logical plan 与 stage ids 可观察；SQL 没有专用稳定 public trace contract；
- registry initialize/destroy 足以实现 per-execution cleanup；
- 跨 datasource atomic 仍在执行前拒绝。

因此 v1 不创建 `depa-orm` external track。runtime track 直接实现上述 adapter 与 diagnostics；未来若新增跨 datasource 事务或正式 SQL trace effect，应由独立 mission/track 评估。

## Operation Runtime

runtime 是数据和依赖载体，不包含业务方法：

```ts
interface DomainOperationRuntime {
  readonly bundle: LoadedDomainContext
  readonly modelCatalog: CompiledModelCatalog
  readonly targets: TargetResolver
  readonly handlers: OperationHandlerRegistry
  readonly reader: DepaOrmReader
  readonly writer: DepaOrmWriter
  readonly capabilities: RuntimeCapabilities
  readonly observations: ObservationSink
  readonly effects: RuntimeEffects
}
```

执行逻辑外置为函数。Operation handler 由 ref 注册，输入为 runtime、targets、invocation、config，输出 normalized result。handler 不读取 module-global DB、环境单例或页面状态。

Request parse、exact shape、preset/catalog parity、batch verb/subject 同构和 capability intersection 必须在 SQLite allocation、seed 与 handler 之前完成。preflight 失败时不得创建数据库或产生 handler side effect。

## Server Composition

`packages/web-server` 增加：

- validated bundle registry；
- catalog routes；
- execute route；
- per-request lifecycle owner；
- request size、timeout/cleanup 和 structured error boundary。

可以复用现有 Kon endpoint 的 Elysia/CORS/test 组织方式，但不能复用其应用级共享 SQLite 实例。server route 不包含领域 switch，也不直接拼 SQL。

## Web IDE

新增 `/domain-workbench` 实际工作台，不做 landing page。主要区域：

1. domain context bundle selector；
2. 只读 Kon source tabs；
3. semantic resources，按 BO、association、lifecycle、constraint、process 等分类；
4. Operation catalog filter，使用 owner/behavior/subject/effect；
5. preset selector；
6. request JSON editor 与 schema diagnostics；
7. Execute command；
8. result tabs：Outcome、Changes、Before/After、Operation Tree、Plan/SQL、Diagnostics。

交互规则：

- 切换 preset 生成一个完整 request；
- 编辑器直接修改完整 request；catalog-owned 字段若被改得与 definition 不一致，preflight 明确拒绝；
- Execute 前展示的 request 与发送 body 相同；
- batch item 的 success/error 可逐项查看；
- unsupported capability 在 Diagnostics 中可见；
- UI 不允许编辑 Kon、上传代码或直接修改数据库。

页面使用当前应用设计语言，保持操作台密度，不使用营销式 hero。desktop 与 mobile 都要保证 editor、tabs、table/graph 不重叠。

## 验证策略

### Contract

- single/selection/batch discriminated union；
- operation/catalog mismatch；
- JSON roundtrip 与 schema compatibility；
- response outcome union 和 diagnostics codes。

### Runtime

- 同一 preset 连续执行结果一致；
- 并发执行不共享 DB；
- seed/execute/observe 任一步失败仍 cleanup；
- registry unknown ref 明确失败；
- atomic/best-effort capability gate；
- definition/binding/server capability intersection 的逐层拒绝；
- preset request 结构和值在 load、preview 和 execute 之间保持不变；
- mixed batch verb 或 subject kind 在分配资源前被拒绝；
- public import boundary guard；
- operation tree 保留 child refs。

### Server

- catalog 与 bundle version；
- preview request 可直接 POST；
- status/error envelope；
- unknown context/operation/preset；
- cleanup 和 request isolation。

### Browser

- 选择 bundle、查看只读 Kon；
- 过滤并选择每类 Operation；
- preset -> preview -> edit -> execute；
- outcome/diff/trace/diagnostics；
- selection 与 batch 在 UI 上语义可区分；
- desktop/mobile screenshot、console 和 network assertions。

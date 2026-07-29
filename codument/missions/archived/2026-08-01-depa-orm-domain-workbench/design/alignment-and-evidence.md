# Alignment And Evidence

## 引用约定

本文件只保存路径无关的逻辑项目引用。执行 session 负责把以下前缀绑定到实际 workspace：

- `spl-bun:`
- `depa-orm:`
- `framework-dsl:`
- `ontology-v5:`
- `ontology-xml-dsl:`
- `cozo-om:`

兄弟项目是设计证据，不是 mission 的 build dependency。

## SPL Workspace

关键 evidence：

- `spl-bun:packages/web-ide/src/pages/KonIde.vue`
- `spl-bun:packages/web-ide/src/pages/konDemos.ts`
- `spl-bun:packages/web-server/src/server.ts`
- `spl-bun:packages/web-shared/src/index.ts`
- `spl-bun:packages/web-server/__tests__/execute-kon.test.ts`
- `spl-bun:packages/depa-orm-capsule/docs/dsl-bundle/**`
- `spl-bun:packages/depa-orm-capsule/__tests__/architecture/**`
- `spl-bun:packages/depa-orm-capsule/__tests__/integration/sqlite/**`

可借鉴：

- demo catalog、source editor、Run、ResultTable 的用户闭环；
- Elysia endpoint、shared DTO、每请求 fresh Kon runtime；
- server/IDE contract 与 E2E 组织方式。

不可直接复制：

- 当前 server 的 SQLite 是应用级共享实例，不符合本 mission 的 per-execution DB；
- 当前 `/api/execute-kon` 只表达 Kon source execution，不表达 domain Operation catalog；
- `depa-orm-capsule` 没有 production `src`，其 tests/fixtures 不能成为工作台运行时。

## Depa ORM

关键 evidence：

- `depa-orm:packages/depa-orm-dsl-kon/src/index.ts`
- `depa-orm:packages/depa-orm-engine-contract/src/index.ts`
- `depa-orm:packages/depa-orm-engine-contract/src/mutation.ts`
- `depa-orm:packages/depa-orm-engine-contract/src/storage-port.ts`
- `depa-orm:packages/depa-orm-engine-contract/src/orm/query/value/select-query.ts`
- `depa-orm:packages/depa-orm-engine-logic/src/pipeline.ts`
- `depa-orm:packages/depa-orm-engine-assemble/src/reader.ts`
- `depa-orm:packages/depa-orm-engine-assemble/src/writer.ts`
- `depa-orm:packages/depa-orm-engine-assemble/src/operation-runtime.ts`
- `depa-orm:packages/depa-orm-engine-support-sqlite/src/sqlite-storage.ts`

当前边界：

- package 依赖保持 `dsl-kon -> contract`、`logic -> contract`、`support-sqlite -> contract`、`assemble -> contract + logic`；
- application 注入 SQLite registry/effects；
- public Reader 返回 plan/rows/stageIds，Writer 返回 plan/result/stageIds；
- `WriteMutation` 是单 mutation contract；
- public query 使用 value/class contract，HTTP 需要 JSON DTO adapter；
- SQLite 可支持 atomic transaction，但逐项 batch mapping 和跨 mutation unit-of-work 需要 G2 查证。

## Framework DSL

关键 evidence：

- `framework-dsl:spec/capability-resource.md`
- `framework-dsl:spec/business-object-resource.md`
- `framework-dsl:std/resource-bundle.md`

稳定概念：

- WebApi 拥有固定 HTTP method/path；
- ComposedFunc 是非 HTTP 的组合入口；
- BO Action 是业务可执行层，可调用 WebApi/ComposedFunc；
- SOP 是非 callable procedure；
- BO input 使用 `subject / verb / payload`；
- single subject 使用 discriminated ref，集合操作使用 selector/where 语义；
- contract、logic、DSL declaration 和 target projection 各有唯一 owner。

差异：

- framework-dsl 当前把 Action 作为 BO 唯一 executable layer；
- 本 mission 必须同时表达独立 BO Mutation、association/lifecycle/constraint/process 和 raw operation；
- 因此借用其输入封套和 capability 分层，不复制“BO 只有 Action 可执行”的限制。

## Ontology V5

关键 evidence：

- `ontology-v5:Ontology.xml`
- `ontology-v5:BusinessObjects/ItAssetManagement/DamageCase/Actions/CancelRepair.xml`
- `ontology-v5:BusinessObjects/ItAssetManagement/DamageCase/Mutations/MarkCanceled.xml`
- `ontology-v5:BusinessObjects/ItAssetManagement/DisposalApplication/Actions/ScrapAndDispose.xml`
- `ontology-v5:BusinessObjects/ItAssetManagement/AcceptanceNotice/Lifecycles.xml`
- `ontology-v5:BusinessObjects/ItAssetManagement/AssetInbound/ConstraintHandlers.xml`
- `ontology-v5:BusinessProcesses/ItAssetManagement/ReturnReinbound.xml`

稳定概念：

- BO-first，但 Association、BusinessProcess 和 DomainPolicy 拥有跨 BO 语义；
- Action 与 Mutation 是不同资源；
- Action 可以声明多个 Mutation；
- Lifecycle、ConstraintHandler、Evidence 和 RuntimeBinding 是一等资源；
- ExtensionPoint 表达有契约但需要目标 runtime binding 的行为；
- evidence 是实际 material，不是只有标签。

这些概念直接支撑 Operation owner/behavior 维度和 operation tree。

## Ontology XML DSL

关键 evidence：

- `ontology-xml-dsl:SKILL.md`
- `ontology-xml-dsl:std/ontology-bundle.md`
- `ontology-xml-dsl:spec/ontology-resource.md`
- `ontology-xml-dsl:spec/lifecycle-resource.md`
- `ontology-xml-dsl:spec/rule-resource.md`
- `ontology-xml-dsl:spec/evidence-resource.md`

可借鉴：

- canonical semantic source 与 generated/runtime projections 单向分离；
- local BO owner 与 cross-BO owner 分离；
- Portable 与 ExtensionPoint/RuntimeBinding 分离；
- evidence、uncertainty 和 projection drift 可观测。

已知规范差异：

- SKILL 把 BO-first v5 作为 canonical；
- 当前部分 spec/validator 仍描述 TypeModule/RelationModule 等旧模块 grammar；
- ontology v5 evidence 使用直接 material，而部分旧 spec 使用另一种结构。

本 mission 不裁决或依赖这些 XML grammar，只提取已在多个证据中稳定的语义。

## Cozo OM 与 Viz

关键 evidence：

- `depa-ontology.ts:packages/depa-ontology/cozo-om.d.ts`
- `depa-ontology.ts:packages/depa-ontology/cozo-om.js`
- `depa-ontology.ts:packages/depa-ontology/__tests__/om-mutation.test.js`
- `depa-ontology.ts:packages/depa-ontology/__tests__/om-action.test.js`
- `depa-ontology.ts:packages/depa-ontology/__tests__/om-interceptor.test.js`
- `depa-ontology.ts:packages/depa-ontology/__tests__/om-behavior-portability-contract.test.js`
- `depa-ontology.ts:packages/depa-ontology/__tests__/om-behavior-portability-import.test.js`
- `depa-ontology.ts:packages/depa-ontology/__tests__/om-schema-snapshot-diff.test.js`
- `depa-ontology.ts:packages/depa-ontology/demo-resource-graph.js`

稳定概念：

- `depa-ontology.ts/packages/depa-ontology` 是当前 TypeScript/Bun OM 真源；
- Type/Mixin/Property/inheritance 是 profile-neutral 的底层类型系统；
- BehaviorCatalog kinds 包含 constraint、computed、action、mutation、interceptor；
- schema snapshot 与 behavior manifest 分别提供结构和行为元数据导出入口；
- Action handler 可以返回 ordered MutationSpec，executeMutations 在事务内执行；
- raw operations 包含 createEntity、setProperty、linkEntities、ingestBatch；
- analysis templates 包含 impactAnalysis、ownershipTree、riskHotspot；
- demo 代码使用预制模型和 fresh DB 展示快速原型。

需要改进的点：

- viz HTTP 主要只传 demoId/queryId，不能作为跨实现标准 API；
- module-global registry/shared mutable state 不进入本 mission runtime；
- raw、Action、Mutation、analysis template 都应通过统一 Operation contract 表达，同时保留各自 owner/behavior。

## 收敛后的共同语言

| 共同概念 | 本 mission 采用方式 |
| --- | --- |
| bounded domain bundle | `DomainContextBundle` |
| target-neutral callable declaration | `OperationDefinition` |
| BO input envelope | single invocation 的 subject/verb/payload |
| collection selector | `subject.kind=selection` |
| multiple independent calls | `invocation.mode=batch` |
| Action composed of Mutations | operation tree + child refs |
| non-BO/cross-BO owner | association/lifecycle/constraint/business-process/capability/raw |
| runtime binding | server-side registered handler，不从 HTTP 注入 |
| evidence/observation | before/after/diff/trace/diagnostics |
| fresh prototype state | per-execution seeded SQLite |
| reusable HTTP standard | independent contracts capsule |

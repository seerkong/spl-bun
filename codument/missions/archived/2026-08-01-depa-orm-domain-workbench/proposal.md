# Mission: depa-orm domain workbench

## 背景与动机

当前 workspace 已有两组可以复用但职责不同的基础：

- `depa-orm` 提供 Kon 类型模型编译、查询/写入规划、关系处理和 SQLite effect 注入；
- `packages/web-server` 与 `packages/web-ide` 已形成“预制示例、查看请求、执行、观察结果”的 Kon SPL 调试路径。

目标不是再做一个只会执行 BO Action 的 demo，而是建立一个关系数据库版本的领域建模与操作工作台：每个预制 bundle 是一个 domain context，包含只读 Kon 模型、语义资源、Operation 定义、调用预设和 seed data；用户选择预设后可以检查并编辑实际 HTTP 请求 JSON，执行后观察 outcome、状态变化、执行树、计划和 diagnostics。

兄弟项目已经提供了需要靠拢的领域语言：

- framework-dsl 区分 WebApi、ComposedFunc、BusinessObject、Action 和 SOP，并使用 `subject / verb / payload` 表达 BO 调用；
- ontology v5 把 BusinessObject、Association、Lifecycle、ConstraintHandler、BusinessProcess、Action 和 Mutation 作为不同语义资源；
- depa-ontology.ts 的 Cozo OM 提供类型/继承、behavior catalog、事务 Mutation、schema snapshot、behavior manifest 导入导出，以及 raw CRUD、批量导入和图分析类原始操作；
- ontology-xml-dsl 强调 BO-first、跨 BO owner、证据与 RuntimeBinding 边界。

这些项目是语义证据，不是本 mission 的运行时依赖。关系数据库实现需要在思想和 HTTP 契约上趋同，同时遵守 `depa-orm` 当前公开 API 和能力边界。

## 目标

- 定义可复用、与 SPL 页面解耦的 Domain Operation HTTP contract。
- 让 Operation preset 直接保存完整 `ExecuteOperationRequest v1`；definition 以静态 verb 和 requestable capability set 约束请求，不维护第二份隐式模型。
- 固化 Operation 的五个正交维度：owner、behavior、subject、invocation、effect。
- 以 `selection` 表达“由 selector 圈定并作为一个逻辑主语处理的对象集合”，以 `batch` 表达“一次请求携带多个独立 invocation”。
- 定义 DomainContextBundle，把只读 Kon 模型、语义目录、Operation、调用预设、seed data、runtime binding 和 observation probes 组合为可运行的 domain context。
- 将当前 authority `ontology-exchange-xml-standard` 演进为 latest-only FS-native 分层定义超集：保留独立 Type/Relation/Rule/Lifecycle 内核，以 BO-first profile 覆盖 v5 概念，定义五维 Operation 与 selection/batch preset，并作为 depa-ontology.ts Bun OM 的可读建模与机器导入/导出表示。
- 基于 `depa-orm` 公共入口建立每次请求隔离的 SQLite 执行 runtime。
- 在 `web-server` 提供 catalog 与 execute API，在 `web-ide` 提供 `/domain-workbench` 工作台。
- 提供覆盖 BO、非 BO、单个、selection、batch、关联、生命周期、约束、业务流程、组合能力和 raw operation 的代表性 bundles。
- 通过 mission 控制循环持续比较目标与实际态；能力证据不支持时显式降为 diagnostics、拆分 external track 或受控重规划，不以猜测补齐。

## 非目标

- v1 不支持在线编辑或重新编译 Kon bundle。
- v1 不在请求之间保留数据库或用户会话状态。
- 不允许通过页面提交任意 TypeScript、JavaScript、SQL 或其他运行时代码。
- 不建设通用本体执行引擎，也不枚举 Operation 五维的笛卡尔积实现。
- host runtime 不解析或执行任意 ontology XML，不把 framework-dsl、ontology v5 或 Cozo runtime 变成生产依赖；外部 `ontology-exchange-xml-standard` track 只负责统一定义标准。
- 不把 `packages/depa-orm-capsule/__tests__`、fixture 或 `depa-orm` internals 作为生产依赖。
- 不承诺公开 `depa-orm` API 尚未证实的跨 mutation 原子性、跨 datasource 原子性、逐项 batch 映射或 SQL trace。
- mission 本身不直接实现代码；代码、规范和测试改动全部由真实 track 承担。

## 成功判据

1. 一个独立 contract package 定义 catalog、single/batch execute request、完整 request preset、response、diagnostics 与版本策略，server 和 IDE 使用同一类型。
2. Operation catalog 至少覆盖以下代表性矩阵：
   - domain-context 全局 Operation；
   - raw read 与 raw write；
   - BO single Action 与 BO single Mutation；
   - selection Operation；
   - batch invocation；
   - Association Mutation；
   - Lifecycle Transition；
   - Constraint Validate；
   - BusinessProcess 或 Capability Composed Operation。
3. `selection` 和 `batch` 在类型、JSON 示例、运行时归一化和 UI 上保持无歧义；同一个 batch Operation 的 item 可以有独立值和 payload，但 verb 与 subject shape 必须服从同一个 definition。
4. 每次执行都完整经过 `create -> initialize -> seed -> execute -> observe -> destroy`，不同请求之间无状态泄漏。
5. 预览 JSON 就是完整 `ExecuteOperationRequest v1`，与实际 POST body 字节级语义一致；用户可编辑请求 JSON，但不能编辑 bundle 定义或注入代码。
6. response 可以表达 table、entity、collection、scalar、graph、tree、composite outcome，并提供 effects、before/after/diff、operation tree、plan/可用 SQL trace 和 diagnostics。
7. `atomic` 只在公开能力证明满足时接受；跨 datasource atomic 被拒绝；不支持的逐项结果或 trace 显式报告。
8. server contract/integration tests、runtime tests、bundle matrix tests 和 Playwright desktop/mobile 主流程全部通过。
9. latest ontology XML fixture 同时覆盖独立类型系统、v5 上层语义和 Operation 定义；validator 拒绝旧 Resources/Modules root 与上层 inline structural facts，并把 depa-ontology.ts Bun OM 真源与导入/导出边界固定为可验证规范。
10. 历史 ontology definition track、FS-native manifest authority correction track 与六个 host tracks 均完成、独立验证并归档；若能力审计产生 `depa-orm` 库侧 track，该 track 也必须完成并回流 host 复验。
11. 最终 mission verify 报告确认所有目标已收敛，或把未达成项显式标记为 BLOCKED/SUPERSEDED，而不是以文档完成代替实现完成。

## 为什么需要 Mission

该目标跨越协议、运行时、server、IDE、参考领域 bundles，并可能根据 `depa-orm` 公共能力审计插入外部仓库 track。单个 track 无法同时安全承担语义收敛、跨包依赖、事务能力验证、UI 交付和总体验证。

Mission 负责期望态 DAG、actual-state 观察、track 编排、漂移判断和受控重规划；真实实现由以下候选 tracks 承担：

| Track | 主要责任 |
| --- | --- |
| `add-domain-operation-contracts` | 通用 Operation/catalog/HTTP DTO 与 contract tests |
| `align-skills-with-bo-first-ontology-xml` | 历史 Resources-based 分层 grammar 与 Operation 语义证据 |
| `align-fs-native-ontology-manifest-authority` | latest-only FS-native manifest grammar、validator、depa-ontology.ts 导入/导出 authority 与旧 assembly 拒绝 |
| `align-domain-operation-preset-contract` | 完整 request preset、静态 verb、requestable capabilities 与 catalog/preset consistency 校正 |
| `add-depa-orm-domain-runtime` | bundle loader、DEPA 归一化、隔离 SQLite runtime、handler registry 与 observations |
| `add-domain-operation-server-api` | catalog/execute endpoints、错误与生命周期 composition |
| `add-domain-context-reference-bundles` | 代表性 domain contexts、operation matrix、seed 和 presets |
| `add-domain-workbench-ui` | `/domain-workbench`、JSON preview/editor、执行与多视图结果 |

`depa-orm` 库侧 track 不预先虚构。G2 先审计 public capability；只有证据表明 host adapter 无法正确实现已确认目标时，才通过 mission replan 增加 external TrackLink。

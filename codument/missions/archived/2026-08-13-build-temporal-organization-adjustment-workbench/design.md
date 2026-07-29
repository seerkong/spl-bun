# Mission Design: temporal organization adjustment workbench

## 控制目标

- **desired state**：`mission.xml` 的 G1-G5 DAG、三条真实 TrackLink、本文与 `design/` 中的 authority/时间/事务不变量、`proposal.md` 的成功判据。
- **actual state**：contract/runtime/bundle/server/workbench 源码，Codument behavior/track 状态，SQLite 读写事实，测试、HTTP capture、Playwright 和 fresh verify reports。
- **actuation**：创建、执行、验证、归档真实 track；以 evidence 修订 mission；对不支持的 timeline/capability 返回结构化 diagnostics。
- **feedback / drift**：exact parser/catalog match、双时间查询、唯一写者 guard、事务回滚、operation matrix、fresh isolation、production API 和浏览器验证。

Mission 标准 Actor 协议以 `codument/std/spec/mission-xml-spec.md` 为准，具体 actor 工作方式已在 `mission.xml` materialize。

## 核心架构不变量

1. `OrganizationAdjustment`/`OrganizationAdjustmentItem` 是未应用命令的唯一 authority；类型化 temporal fact rows 是已应用组织事实的唯一查询和历史 authority。
2. `OrganizationChangeEvent` 只提供同事务 append-only audit evidence，不参与 live state fold，也不承诺从事件重建事实表。
3. snapshot/history/diff/impact preview 是只读派生投影，不能持久化后反写 temporal facts。
4. 业务有效时间使用 `[validFrom, validTo)`；系统记录时间使用 `[recordedFrom, recordedTo)`。空上界表示正无穷。
5. 时间事实不物理删除。修订关闭旧 row 的 `recordedTo` 并插入 replacement row；业务变化通过 replacement/open period 表达。
6. 关系 authority 仍在 typed Kunun Property 的 `orm :relation` NamedConf；标量外键 Field 不是关系定义。
7. Runtime 拥有 compile/create/initialize/seed/transaction/observe/destroy。Bundle handler 不创建连接、不保存 module-global execution state，只通过 handler context 读写。
8. 组织 bundle 内只有 `OrganizationAdjustmentWriter` 可以推进 adjustment 和写 temporal facts/event；query/validator/projector 不持有 write effect。
9. Operation 仍以 `operation.ref` registry 分发。owner/behavior/subject/invocation/effect 和 timeline capability 只用于声明、校验与筛选，不形成 handler switch。
10. 完整 `OperationPresetDto.request` 仍是请求唯一 authority；UI timeline control 只编辑同一 JSON request，不建立第二请求模型。

## DEPA 映射

| 轴 | 本 mission 映射 |
| --- | --- |
| Data | immutable catalog/model source/seed、adjustment command rows、temporal fact rows、audit event、response projections |
| Effect | handler context 的 read/write/invokeChild；SQLite datasource transaction；server transport |
| Processor | date/parser、bitemporal predicate、constraint validator、snapshot/diff projector、adjustment planner |
| Actor | runtime bootstrap actor、operation registry/handler、私有 OrganizationAdjustmentWriter、mission 四 actor |

通用 Operation 的执行边界解释为：

```text
runtime    = DomainOperationHandlerContext
targets    = subject/selector 解析出的稳定引用
invocation = invocation + timeline
config     = immutable definition + binding
```

## Plan 与 Track

Mission 只负责事实盘点、desired DAG、authority 协调、track 生命周期和最终验收。代码、行为增量、测试和 UI 落地全部由真实 track 完成，没有直接实现例外。

```text
evidence/authority freeze
  -> add-day-timeline-operation-contracts
  -> add-temporal-organization-context-bundle
  -> add-organization-timeline-workbench
  -> full verify + mission gap loop
```

## 详细设计索引

- [Temporal Relational Model](design/temporal-relational-model.md)：双时间语义、关系存储和查询规则。
- [Organization Domain Model](design/organization-domain-model.md)：BO、Property relations、调整状态机、唯一写者和约束。
- [Operation API](design/operation-api.md)：timeline DTO、Operation matrix、registry 与错误边界。
- [Verification Matrix](design/verification-matrix.md)：可判定场景、失败语义和证据路径。
- [Reference Alignment](design/reference-alignment.md)：与 depa-ontology/Cozo 的相同思想和明确差异。

## 受控重规划

active mission 只有在以下 evidence 出现时才修订 DAG 或设计：

- depa ORM 公共 query AST 无法表达双时间 predicate；
- SQLite adapter 不能保证 adjustment apply 的单 datasource outer transaction；
- Property-first model 无法表达同一时间表到同一 BO 的双角色关系；
- exact request parser 的 additive timeline 会破坏现有 v1 request；
- Workbench 单一 JSON authority 无法与日期控件保持无影子状态同步；
- fresh verify 证明 authority、rollback、batch 或 isolation 不成立。

每次 replan 必须写 `reports/replan-XXX.md`，说明 trigger、actual、desired、diff、decision 和 applied change，并更新 `Metadata.Revision`/`UpdatedAt`。

## 主要风险

| 风险 | 控制措施 |
| --- | --- |
| audit event 与 temporal facts 形成双真值 | 明确 event 只审计，不 replay；temporal facts 是查询 authority |
| 日期字符串按字典比较却接受非法日历日 | contract strict calendar validation + canonical `YYYY-MM-DD` |
| valid time 与 recorded time 混用 | 字段/查询/测试双轴分离，默认 recordedAt 表示当前系统知识 |
| 多个 handler 直接写组织事实 | 私有 writer 单入口、read-only effect guard、源码/行为测试 |
| apply 先部分提交再失败 | 单 datasource outer transaction + injected mid-write failure + before/after equality |
| 调整状态可跳步 | transition table + apply-time revalidation + invalid transition tests |
| batch 与 selection 再次混淆 | transfer batch 每 item 一个 Person subject；组织范围 query 使用 selection |
| UI 日期控件成为 shadow request | 控件值只从 JSON 派生并原位更新 JSON，POST 仍使用 editor exact text |

## 人工介入

`QuestionSeverity=auto`。当前没有 pending decision；所有保守默认已写入 `decisions.xnl`。只有新的用户目标冲突、无法自动修复的公共能力缺口、真实 external blocker、mission 终态或十条 track checkpoint 才返回。

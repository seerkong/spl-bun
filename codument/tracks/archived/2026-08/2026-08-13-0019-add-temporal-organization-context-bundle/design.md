# Design: temporal organization context bundle

## Authority

- `OrganizationAdjustment` 与有序 `OrganizationAdjustmentItem`：未应用 command authority。
- 三类 typed temporal tables：已应用组织事实的 snapshot/history authority。
- `OrganizationChangeEvent`：append-only audit evidence，不用于 rebuild。
- snapshot/history/compare/preview：每次从事实表派生，不持久化。
- private `OrganizationAdjustmentWriter`：模块内唯一 `context.write` owner。

## Relational Model

稳定 identity 使用 `OrganizationUnit` 与 `Person`。可变组织事实使用：

```text
OrganizationUnitVersion: unitId + name/type/status + valid/recorded interval
OrganizationHierarchyPeriod: childUnitId -> parentUnitId + valid/recorded interval
PersonAssignmentPeriod: personId -> unitId + role/manager/allocation/primary + valid/recorded interval
```

每个 temporal row 有 synthetic `id` 作为 ORM primary key，并包含 `[validFrom, validTo)` 和 `[recordedFrom, recordedTo)`。`null` upper bound 表示正无穷。所有关系 metadata 仅附着到 typed Property；外键 Field 没有 relation metadata。

Seed 在 `2025-07-01` 形成可见边界：单位名称、一个层级和一个人员主任职发生变化。所有 request 仍在 fresh SQLite 上执行。

## Query Semantics

Snapshot 使用 mission 固定的双时间 predicate。Request 未给 `recordedAt` 时，只读取 `recordedTo IS NULL` 的当前知识；给定时使用完整 recorded interval。Hierarchy 和 assignments 与有效 unit versions 合并为确定性 tree outcome。

History 返回 subject 的 ordered temporal rows。Compare 计算 range 两端 snapshot 的 added/removed/moved/renamed facts，返回 deterministic composite outcome。所有查询 operation 为 read-only，依赖 runtime effect guard。

## Adjustment Workflow

状态路径：

```text
DRAFT -> VALIDATED -> APPROVED -> APPLIED
   |          |            |
   +----------+------------+-> CANCELLED
```

`Validate` 与 `Preview` 都是 read-only，并调用同一纯 candidate-state validator。数据加载器只通过 read port 取得 adjustment、identity 与全部 current-recorded temporal facts；纯 validator 只接收这些 facts，投影指令执行后的完整时间线，不接收 handler context。它同时校验 canonical valid/recorded bounds、interval order、temporal identity references、overlap、primary uniqueness 与 hierarchy cycle。为避免 read-only operation 偷写状态，本 bundle 增加 `Organization.Adjustment.MarkValidated` lifecycle transition；它必须在同一 atomic execution 内先运行共享 validator，只有通过后才让私有 Writer 执行 `DRAFT -> VALIDATED`。失败时 status、temporal facts 和 audit 全部不变。`Approve` 只接受 VALIDATED；`Apply` 只接受 APPROVED，并在 outer transaction 已开始后再次运行相同 validator。

Apply items 支持 `rename-unit`、`move-unit`、`transfer-person`、`create-unit` 与 `close-unit`。`create-unit` 要求 parent stable identity 存在，且在 effective day 恰有一个 `status=ACTIVE` 的可见版本；`close-unit` 要求没有未处理主任职或 child unit，并同时关闭 unit version 与它拥有的 parent hierarchy periods。Presets 实际执行 rename/transfer/create/close，并为 cycle、missing target、overlap、dangling relation 和非法状态提供稳定失败证据。

## Unique Writer

除 `OrganizationAdjustmentWriter` 外，production module 不得出现 `context.write`。Writer 提供状态 transition、temporal row replacement、audit append 与 batch adjustment methods。替换 temporal fact 时不 delete：关闭旧 current-recorded row，再插入 replacement rows，全部使用 `context.recordedAt`。

Validator 独立检查两类不可合并的不变量：

1. 同一 temporal identity 的 current-recorded valid intervals 不得重叠；
2. 同一 Person 在任一业务日最多一个 active primary assignment。

`MarkValidated` 和 `Apply` 都运行两条规则；Apply 的检查明确发生在其 transaction 内。Apply handler 只负责读取、编排和调用 Writer。可选 developer failure payload `failAfterStep` 仅用于预制 rollback 场景，并在真实第一段 replacement 后抛出；outer runtime transaction 必须回滚所有写入。

Writer 内部拥有合法状态边，handler 不能通过传入任意目标状态跳转。写 operation 的 constraint failure 抛出 runtime 公开 `DomainOperationExecutionError`，保留 validation code/path 并由 outer transaction 负责回滚；它不替代 preflight/admission diagnostics authority。

## Batch Semantics

`Organization.Person.TransferBatch` 是 `subject=single, invocation=batch`。每个 item 有独立 Person subject、target unit、role 和稳定 key。Writer 为每个 item 创建 DRAFT adjustment 和 item，在同一 item transaction 内按 `DRAFT -> VALIDATED -> APPROVED -> APPLIED` 逐边推进，应用 assignment replacement 并追加 audit：

- atomic：任一 item invalid，整批回滚；
- best-effort：runtime 按 item 独立事务调度，成功 sibling 保留，失败 item 映射 diagnostic path。

业务有效性不依赖 atomicity：handler 按 request item 顺序加载最新 transaction-visible 的完整 current-recorded validation snapshot，把每个 item 投影成一条 synthetic adjustment command，并调用与 Preview/Validate/Apply 相同的纯 validator，验证通过后才创建 DRAFT 和进入 Writer。因此重复 Person subject 的独立指令在 atomic/best-effort 下依次应用并得到相同最终事实；两者只在后续 item 失败时的 commit/rollback 调度上不同。

Selection 不参与该 operation。

## Public Boundary

`organizationAdjustmentBundle` 与 plain `organizationAdjustmentBundleRegistration` 从 package root 导出。现有 `referenceBundleIds/referenceBundles/referenceBundleRegistrations` 在 G3 保持两个 bundle，G4 才将组织域接入 production server，防止 package capability 与 deployment composition 混为一层。

## Verification

- model/catalog tests：8 entities、Property-first navigation、exact presets、frozen bundle、no execution state。
- query tests：两个 boundary snapshots、history、compare、recorded slice。
- workflow tests：preview/validate zero writes、MarkValidated 同事务 validate-then-transition、approve/apply、invalid transition/cycle/missing target/interval-overlap/primary-assignment-uniqueness rejection、rollback。
- batch tests：atomic rollback、best-effort partial mapping、consecutive/concurrent fresh execution。
- package build/import guard/Codument strict/XML/diff/fresh AttractorCheck/independent verify。

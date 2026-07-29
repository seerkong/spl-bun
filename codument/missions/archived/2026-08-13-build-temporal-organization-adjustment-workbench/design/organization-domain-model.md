# Organization Domain Model

## Business Objects

| BO | 稳定职责 |
| --- | --- |
| `OrganizationUnit` | 组织单元 identity 与不随时间改变的创建事实 |
| `OrganizationUnitVersion` | 单位在 valid/recorded 双时间下的名称、类型、状态 |
| `Person` | 人员 identity 与稳定人员编号 |
| `OrganizationHierarchyPeriod` | child-parent 组织层级期间 |
| `PersonAssignmentPeriod` | 人员任职、role、manager、allocation 与主任职期间 |
| `OrganizationAdjustment` | 一次计划性组织变更的 workflow aggregate |
| `OrganizationAdjustmentItem` | 有序变更命令，如 rename/move/transfer/create/close |
| `OrganizationChangeEvent` | applied 事务产生的 append-only audit evidence |

## Property-first Relations

关系只允许附着在 typed Property：

```text
OrganizationUnit.versions <-> OrganizationUnitVersion.unit
OrganizationUnit.parentPeriods <-> OrganizationHierarchyPeriod.childUnit
OrganizationUnit.childPeriods <-> OrganizationHierarchyPeriod.parentUnit
Person.assignments <-> PersonAssignmentPeriod.person
OrganizationUnit.assignments <-> PersonAssignmentPeriod.unit
OrganizationAdjustment.items <-> OrganizationAdjustmentItem.adjustment
OrganizationAdjustment.events <-> OrganizationChangeEvent.adjustment
```

`unitId`、`childUnitId`、`parentUnitId`、`personId`、`adjustmentId` 等 Field 只声明 column name/type/nullability。复合关系未来可扩展 ordered key tuples，不把关联语义锁死在单个 `...Id` Field 上。

## Adjustment State Machine

```text
DRAFT -> VALIDATED -> APPROVED -> APPLIED
   |          |            |
   +----------+------------+-> CANCELLED
```

- `DRAFT`：items 可作为待执行命令读取；本 mission 不提供任意脚本。
- `VALIDATED`：已在目标 effective day 上通过当时事实校验；后续事实可能变化，因此不是 apply 免检凭证。
- `APPROVED`：可信开发工具中的审批状态；`actorRef` 记录审计，不构成认证授权。
- `APPLIED`：唯一终态成功，必须由 `OrganizationAdjustmentWriter` 在事务内写入事实、audit event 和状态。
- `CANCELLED`：DRAFT/VALIDATED/APPROVED 可进入，不能恢复或应用。

禁止跳过状态、重复 apply、从 APPLIED/CANCELLED 继续推进。Apply 必须在 transaction 开始后重新执行全部约束验证。

## 唯一写者

组织 bundle 内部建立一个私有 `OrganizationAdjustmentWriter` effect capsule：

- 只有它接收 `context.write` 并可修改 adjustment、temporal facts 和 audit event；
- snapshot/history/diff/projector 只接收 read port；
- validator 只返回结构化 validation facts，不写数据库；
- public Operation handlers 负责 admission/编排并调用 writer，不自行散落 mutation；
- runtime 额外拒绝 `effect=read-only` definition 的 handler 调用 write。

这条边界通过源码 guard、mutation summary、rollback tests 和 import-boundary tests共同验证。

## Adjustment Item Kinds

首版至少支持：

- `rename-unit`：在 effective day 关闭当前 UnitVersion valid segment 并打开新版本。
- `move-unit`：替换 child unit 的 hierarchy period；禁止产生 cycle。
- `transfer-person`：替换人员主任职 assignment period。
- `create-unit`：创建 identity、version 和 hierarchy period。
- `close-unit`：在 effective day 关闭 version/hierarchy，并要求无未处理主任职。

批量人员调动使用独立 batch Operation，每个 item 拥有一个 Person single subject。它不是 selection：batch 表示多个独立 invocation；selection 仍用于圈定一个逻辑 subject set 的 query。

## Constraints

Apply 与 preview/validate 共用同一纯 validator：

1. adjustment effective day 和所有 interval 日期合法；
2. 当前 recorded knowledge 中同 identity 的 valid intervals 不重叠；
3. 每个 Person 在任一日最多一个 active primary assignment；
4. active organization hierarchy 是树/森林且无 cycle；
5. parent/target unit 在 effective day 有有效版本且未关闭；
6. move/transfer 的 source fact 在 effective day 存在；
7. item sequence 唯一且 deterministic；
8. 状态迁移合法，apply 仅接收 APPROVED；
9. replacement rows 使用本次 execution 的同一 `recordedAt`；
10. adjustment apply 与 event/status 更新同事务提交。

## Fresh Execution

延续已接受的 workbench v1 策略：每次 execute 从 deterministic seed 建立独立 SQLite，结束后销毁。跨 preset 演示依靠 seed 中不同状态的 adjustment 和 composed operations，不假装跨 HTTP request 保存上次结果。

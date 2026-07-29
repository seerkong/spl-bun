# Operation Examples

这些示例不是固定业务实现，而是 mission 的语义验收素材。每个参考 bundle 可以换用更小的关系模型，但必须保留对应的 Operation 形状。

## 0. Domain Context Global Operation

`DomainInventorySummary` 不属于某个 BO，而是读取整个 bundle 的模型与实例投影，计算当前 domain context 概览：

```text
owner      = domain-context
behavior   = computed
subject    = none
invocation = single
effect     = read-only
```

它证明“全局 Operation”不需要伪造 BO subject，也不必归入 raw。handler 只能读取本次 execution scope 的稳定 runtime，返回 entity count、association count 和 lifecycle distribution 等 composite outcome。

## 1. BO Action: CancelRepair

来源语义：`DamageCase.CancelRepair` 先检查关联资产和备机归还条件，再调用 `MarkCanceled` 与 `RestoreAssetDamageState` 两个 Mutation。

```text
owner      = business-object / DamageCase
behavior   = action
subject    = single
invocation = single
effect     = mixed
atomicity  = atomic when one supported datasource
```

期望 trace：

```text
CancelRepair
  -> QueryAssociatedAsset
  -> ValidateLoanerReturned
  -> MarkCanceled
  -> RestoreAssetDamageState
```

不能把它压成一个 opaque Writer 调用；response 必须保留 child operation 和失败位置。

## 2. BO Mutation: MarkCanceled

`MarkCanceled` 是独立可调用 Mutation，更新状态、处理人、部门、时间和原因。它与 Action 并列存在，不因被 Action 引用而失去 catalog 身份。

```text
owner      = business-object / DamageCase
behavior   = mutation
subject    = single
invocation = single
effect     = write
```

## 3. Selection Mutation

“归档全部已关闭且未归档的订单”：

```json
{
  "mode": "single",
  "subject": {
    "kind": "selection",
    "selector": {
      "kind": "filter",
      "where": {
        "status": "CLOSED",
        "archived": false
      }
    }
  },
  "verb": "ArchiveEligible",
  "payload": {
    "archivedBy": "u:100"
  }
}
```

selector 圈定多条记录，但这是一个共享 payload、共享业务规则和整体结果的 invocation。

## 4. Batch Invocation

“分别修正两个订单 owner”：

```json
{
  "mode": "batch",
  "items": [
    {
      "key": "a",
      "subject": {
        "kind": "single",
        "ref": {
          "type": "Order",
          "id": "order:1001"
        }
      },
      "verb": "CorrectOwner",
      "payload": {
        "ownerId": "user:alice"
      }
    },
    {
      "key": "b",
      "subject": {
        "kind": "single",
        "ref": {
          "type": "Order",
          "id": "order:1002"
        }
      },
      "verb": "CorrectOwner",
      "payload": {
        "ownerId": "user:bob"
      }
    }
  ]
}
```

两个 item 有独立 payload、result 和 error，因此是 batch。选择 atomic 时必须由 capability 证明；best-effort 时必须保留 item key。

## 5. Association Mutation

“把资产关联到供应商合同”由 association owner 持有，而不是随意塞进 Asset 或 Contract：

```text
owner      = association / AssetCoveredByContract
behavior   = mutation
subject    = single association ref
invocation = single
effect     = write
```

runtime 可以映射为 FK 或 join table，但 semantic ref 不依赖物理表名。

## 6. Lifecycle Transition

`AcceptanceNotice.AcceptanceProgress` 根据 accepted quantity 与 arrival quantity 在 PartialAccepted/FullyAccepted 间派生或迁移：

```text
owner      = lifecycle / AcceptanceProgress
behavior   = transition
subject    = single AcceptanceNotice
invocation = single
effect     = write or mixed
```

guard 在 mutation commit boundary 再验证；页面展示 before state、transition 和 after state。

## 7. Constraint Validate

`AssetInbound.PurchaseSourceMustExist` 检查采购订单来源是否存在：

```text
owner      = constraint
behavior   = validate
subject    = single AssetInbound
invocation = single
effect     = read-only
```

合法的业务 violation 是结构化 outcome，不等同于 transport error。

## 8. Business Process: ReturnReinbound

`ReturnReinbound` 跨 AssetInbound 与 ReturnOrderLine，并受数量、完成标记和进度 policy 约束：

```text
owner      = business-process
behavior   = composed
subject    = selection or single process input
invocation = single
effect     = mixed
```

BusinessProcess 拥有跨 BO 协作；不能把所有逻辑藏进某一个 BO handler。

## 9. Capability Composed Query

framework-dsl 的 `ComposedFunc` 证明组合入口不一定由 BO 拥有。示例 `AssetOverview` 组合台账、盘点和关系查询：

```text
owner      = capability
behavior   = composed
subject    = single asset or selection
invocation = single
effect     = read-only
```

它可以返回 composite outcome，并在 trace 中保留下游 query。

## 10. Raw Operations

非 BO 原始操作同样进入统一 contract：

| Operation | 五维示例 | Outcome |
| --- | --- | --- |
| `impactAnalysis` | raw/query/none/single/read-only | graph |
| `ownershipTree` | raw/query/none/single/read-only | tree |
| `riskHotspot` | raw/query/none/single/read-only | table |
| `ingestBatch` | raw/raw/none/single/write | composite |

`ingestBatch` 名称中的 batch 是 payload 批量导入，不决定 invocation mode。它可以作为一个 atomic raw operation；若一次 request 携带多个相互独立的 ingest invocation，外层才是 `mode=batch`。

## 11. Extension-Point Action

`DisposalApplication.ScrapAndDispose` 接受 ApplyNumber、UserCode 和 SkipScrap，并把具体服务细节交给 RuntimeBinding：

```text
owner      = business-object
behavior   = action
subject    = single DisposalApplication
invocation = single
effect     = mixed
```

工作台只执行 bundle 已注册的 handler。XML/InternalLogic 或 request JSON 都不能成为任意代码执行入口；缺少 binding 时返回 unresolved diagnostic。

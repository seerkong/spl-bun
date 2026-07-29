# HTTP Contract

## Capsule 归属

通用契约放入独立 package，候选名为 `depa-data-domain-operation-contracts`。它只包含：

- JSON-compatible DTO 和 discriminated unions；
- catalog/request/response schema；
- transport-neutral validation/normalization helpers；
- contract fixtures 和 compatibility tests。

它不依赖 Vue、Elysia、SQLite、Kon compiler 或 `depa-orm` implementation。`packages/web-shared` 继续拥有 SPL web 的既有 DTO，不成为 Domain Operation 的长期 owner。

## Catalog API

建议稳定 API：

```text
GET  /api/domain-contexts
GET  /api/domain-contexts/:contextId
GET  /api/domain-contexts/:contextId/operations
GET  /api/domain-contexts/:contextId/presets
POST /api/domain-operations/execute
```

Catalog 返回：

- bundle id/version/title；
- 只读 model source 列表与内容；
- semantic resources；
- Operation definitions、静态 verb、input schema、effect 与 requestable capability set；
- 带完整 request 的 invocation presets；
- server 当前可用 capability projection；它是运行态投影，不是 definition authoring truth。

## Execute Request

Single 示例：

```json
{
  "apiVersion": "1",
  "context": {
    "id": "it-asset-lifecycle",
    "version": "1"
  },
  "operation": {
    "ref": "ItAssetManagement.DamageCase.CancelRepair",
    "ownerKind": "business-object",
    "ownerRef": "ItAssetManagement.DamageCase",
    "behaviorKind": "action",
    "subjectKind": "single",
    "invocationMode": "single",
    "effect": "mixed"
  },
  "invocation": {
    "mode": "single",
    "subject": {
      "kind": "single",
      "ref": {
        "type": "DamageCase",
        "id": "damage:1001"
      }
    },
    "verb": "CancelRepair",
    "payload": {
      "reason": "duplicate request",
      "operator": "u:100"
    }
  },
  "execution": {
    "atomicity": "atomic",
    "observe": ["before", "after", "diff", "trace", "plan"]
  }
}
```

Selection 仍使用 `mode=single`，因为它是一个逻辑调用：

```json
{
  "apiVersion": "1",
  "context": {
    "id": "commerce-operations",
    "version": "1"
  },
  "operation": {
    "ref": "Commerce.Order.ArchiveEligible",
    "ownerKind": "business-object",
    "ownerRef": "Commerce.Order",
    "behaviorKind": "mutation",
    "subjectKind": "selection",
    "invocationMode": "single",
    "effect": "write"
  },
  "invocation": {
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
  },
  "execution": {
    "atomicity": "atomic",
    "observe": ["before", "after", "diff"]
  }
}
```

Batch 示例：

```json
{
  "apiVersion": "1",
  "context": {
    "id": "commerce-operations",
    "version": "1"
  },
  "operation": {
    "ref": "Commerce.Order.CorrectOwner",
    "ownerKind": "business-object",
    "ownerRef": "Commerce.Order",
    "behaviorKind": "mutation",
    "subjectKind": "single",
    "invocationMode": "batch",
    "effect": "write"
  },
  "invocation": {
    "mode": "batch",
    "items": [
      {
        "key": "order-1001",
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
        "key": "order-1002",
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
  },
  "execution": {
    "atomicity": "best-effort",
    "observe": ["after", "diff", "trace"]
  }
}
```

客户端展示的 Preview JSON 必须就是 preset 中的完整 `request`，也必须就是发送给 execute endpoint 的对象。页面不维护第二份隐式 request model；编辑后先做 exact schema 和 catalog validation，再原样提交。Contract-owned objects 拒绝未知字段，只有业务 `payload` 与 filter selector 的 `where` 保持开放 JSON。

## Execute Response

统一 response envelope：

```ts
interface ExecuteOperationResponse {
  readonly apiVersion: "1"
  readonly context: { readonly id: string; readonly version: string }
  readonly operationRef: string
  readonly status: "success" | "partial" | "failure"
  readonly outcome: OperationOutcome | null
  readonly effects: OperationEffects
  readonly observations: OperationObservations
  readonly trace: OperationTrace
  readonly diagnostics: readonly OperationDiagnostic[]
}
```

`OperationOutcome.kind` 至少支持：

- `table`
- `entity`
- `collection`
- `scalar`
- `graph`
- `tree`
- `composite`

其他字段：

- `effects`：requested/committed atomicity、mutation summary、batch item status；
- `observations`：before、after、diff 和 probe snapshots；
- `trace`：operation tree、child refs、stages、公开 plan、可用 SQL；
- `diagnostics`：validation、capability、execution、cleanup 与 unsupported detail。

Batch 的逐项 response 只在 adapter 能提供稳定映射时返回具体 item outcome。若 storage 只保证整体事务而不提供逐项映射，response 必须明确 `itemMapping: "unavailable"`，不能伪造。

## Capability Gate

capability 有四个不可互相替代的 owner：

- Operation definition：可请求集合；
- RuntimeBinding：该实现实际支持集合；
- server：当前环境可用集合；
- request.execution：本次选择。

server 在分配 SQLite、seed 或调用 handler 前，对 request、definition、binding 和 current capabilities 做精确比较：

- `atomic` 要求同一事务边界和同一可证明支持的 datasource；
- 跨 datasource atomic 直接返回 capability error；
- `best-effort` 需要逐 invocation 调度和错误隔离；
- SQL trace 只有公开 effect/plan 能提供时才返回；
- composed operation 必须保留 child operation tree，不能只返回最终行集；
- request 中的五维声明必须与 catalog definition 一致。
- single verb 或所有 batch item verb、所有 batch item subject kind 必须与同一个 definition 一致。

不支持的 capability 使用稳定 diagnostic code，例如：

```text
UNSUPPORTED_ATOMIC_COMPOSITION
CROSS_DATASOURCE_ATOMICITY_REJECTED
BATCH_ITEM_MAPPING_UNAVAILABLE
SQL_TRACE_UNAVAILABLE
OPERATION_CATALOG_MISMATCH
```

## 版本与错误

- `apiVersion` 是 envelope 版本，不等于 bundle version。
- bundle version 固定模型和 Operation 语义；执行必须指定或解析到唯一版本。
- schema/validation 错误返回结构化 path、code、message 和 expected。
- transport status 与 domain outcome 分离；合法执行产生的业务失败仍有完整 response envelope。

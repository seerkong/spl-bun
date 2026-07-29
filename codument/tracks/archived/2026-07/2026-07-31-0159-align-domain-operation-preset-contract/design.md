# Design: Domain Operation Preset Contract Alignment

## Authority

`ExecuteOperationRequest v1` 是唯一 transport request authority。Preset 不再拆解或重建 request；其 `request` 字段就是预览、编辑、校验和 POST 使用的对象。

```ts
interface OperationPresetDto {
  readonly key: string
  readonly title?: string
  readonly operationRef: string
  readonly request: ExecuteOperationRequest
  readonly metadata?: JsonObject
}
```

`operationRef` 是 catalog 导航 link，必须等于 `request.operation.ref`。它不是第二份 Operation definition。

## Operation Definition

Operation definition 保持五维 identity，并增加不属于五维的静态调用与能力事实：

```ts
interface OperationCapabilitySetDto {
  readonly atomicity: readonly ExecutionAtomicity[]
  readonly observations: readonly ObservationChannel[]
}

interface OperationRequestableCapabilitiesDto
  extends OperationCapabilitySetDto {}

interface OperationDefinition {
  readonly ref: string
  readonly ownerKind: OperationOwnerKind
  readonly ownerRef?: string
  readonly behaviorKind: OperationBehaviorKind
  readonly subjectKind: OperationSubjectKind
  readonly invocationMode: OperationInvocationMode
  readonly effect: OperationEffect
  readonly verb: string
  readonly capabilities: OperationRequestableCapabilitiesDto
  // display and schema fields unchanged
}
```

Definition capability 语义是“可请求集合”，不是默认执行选择。`atomicity` 必须非空；`observations` 可以为空；两个数组都拒绝重复值。

`DomainOperationCapabilities` 继续表示 server catalog 的当前 capability projection，但静态 catalog match 不把它当成 definition authority。后续 runtime 负责计算：

```text
effective support =
  definition requestable
  ∩ runtime binding actual
  ∩ current server projection
```

## Exact Request Grammar

`parseExecuteOperationRequest` 对所有 contract-owned object 使用 exact keys：

| Object | Allowed keys |
| --- | --- |
| root | `apiVersion`, `context`, `operation`, `invocation`, `execution` |
| context | `id`, `version` |
| operation | `ref`, `ownerKind`, `ownerRef?`, `behaviorKind`, `subjectKind`, `invocationMode`, `effect` |
| single invocation | `mode`, `subject`, `verb`, `payload` |
| batch invocation | `mode`, `items` |
| batch item | `key`, `subject`, `verb`, `payload` |
| none subject | `kind` |
| single subject | `kind`, `ref` |
| selection subject | `kind`, `selector` |
| ref | `type`, `id` |
| all selector | `kind` |
| ids selector | `kind`, `ids` |
| filter selector | `kind`, `where` |
| execution | `atomicity`, `observe` |

`payload` 和 `filter.where` 是显式开放的 JSON value/object；它们的内部 key 不受 contract parser 限制。未知 contract key 返回 path-aware issue。

`execution.observe` 必须无重复项。`ids` selector 保持数组语义；是否允许空 ids 不在本 track 新增业务约束。

## OwnerRef Contract

ownerRef 只表达语义 owner identity，不回退到 lower fact：

| ownerKind | ownerRef |
| --- | --- |
| `domain-context` | 禁止 |
| `raw` | 可选；存在时必须为非空字符串 |
| `business-object` | 必填 |
| `association` | 必填 |
| `constraint` | 必填 |
| `business-process` | 必填 |
| `capability` | 必填 |
| `lifecycle` | 必填 |

引用目标 kind 的闭包由 authoring/ontology 层验证；transport contract 只验证 presence 与字符串形状。

## Catalog And Preset Match

`validateOperationCatalogMatch` 是纯静态一致性检查：

- request 与 catalog 的 `apiVersion`、context id/version 一致；
- request operation 的五维和 ownerRef 与 definition 一致；
- single verb 或每个 batch item verb 等于 definition verb；
- invocation mode 与 definition 一致；
- single subject 或每个 batch item subject kind 等于 definition subject kind；
- request atomicity 和 observations 属于 definition requestable set。

Batch item 可以有独立 key、subject value、payload 和结果，但同一个 batch Operation 的 verb 与 subject shape 由同一个 definition 约束，不允许在一个 request 中混入不同 Operation 形状。

`validateOperationPresetCatalogMatch` 先验证 `preset.operationRef === preset.request.operation.ref`，再复用 catalog match，并把 issue path 前缀到 `$.request`。

## Compatibility

这是有意的窄范围 breaking change。仓库内不存在 package 外生产消费者，旧 DTO 不保留 alias，避免 runtime 和 bundles 继续依赖歧义模型。Response contract 不变。

## Verification

- 先以 tests 固定 exact envelope、ownerRef 和 duplicate observation 的 RED 行为。
- 再固定 definition verb/capability、batch 同构、preset parity 和 subset 的 RED 行为。
- 实现后运行 focused tests、package declaration build、root build 与 package-boundary scan。
- fresh verifier 独立运行验收；通过后才归档 track。

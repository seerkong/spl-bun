# Operation API

## Timeline Contract

`ExecuteOperationRequest` 新增可选顶层 `timeline`。Operation definition 新增可选 requestable timeline declaration；它不是 Operation identity 的第六维，也不是 server 环境 capability。

```ts
type OperationTimelineContext =
  | {
      readonly mode: "as-of";
      readonly granularity: "day";
      readonly asOf: string;
      readonly recordedAt?: string;
    }
  | {
      readonly mode: "effective-on";
      readonly granularity: "day";
      readonly effectiveOn: string;
      readonly recordedAt?: string;
    }
  | {
      readonly mode: "range";
      readonly granularity: "day";
      readonly from: string;
      readonly to: string;
      readonly recordedAt?: string;
    };

interface OperationTimelineCapabilitiesDto {
  readonly granularity: "day";
  readonly modes: readonly ("as-of" | "effective-on" | "range")[];
  readonly required: boolean;
}
```

Exact parser 递归拒绝 timeline 自有对象的未知字段，校验真实日历日、range `from <= to` 和 UTC recorded instant。Catalog match 校验 required、mode 与 granularity；无 timeline declaration 的 Operation 不接受 timeline。现有非时间 requests 不变。

## Request Example

```json
{
  "apiVersion": "1",
  "context": {
    "id": "organization-adjustment",
    "version": "organization-adjustment@1"
  },
  "operation": {
    "ref": "Organization.Timeline.Snapshot",
    "ownerKind": "domain-context",
    "behaviorKind": "query",
    "subjectKind": "none",
    "invocationMode": "single",
    "effect": "read-only"
  },
  "timeline": {
    "mode": "as-of",
    "granularity": "day",
    "asOf": "2025-07-01"
  },
  "invocation": {
    "mode": "single",
    "subject": { "kind": "none" },
    "verb": "organizationSnapshot",
    "payload": {}
  },
  "execution": {
    "atomicity": "atomic",
    "observe": ["before", "after", "diff", "trace", "plan"]
  }
}
```

## Operation Matrix

| Ref | owner | behavior | subject | invocation | effect | timeline |
| --- | --- | --- | --- | --- | --- | --- |
| `Organization.Timeline.Snapshot` | domain-context | query | none | single | read-only | as-of |
| `Organization.Timeline.History` | business-object | query | single | single | read-only | range |
| `Organization.Timeline.Compare` | capability | computed | none | single | read-only | range |
| `Organization.Adjustment.Preview` | business-process | validate | single | single | read-only | effective-on |
| `Organization.Adjustment.Validate` | business-object | validate | single | single | read-only | effective-on |
| `Organization.Adjustment.Approve` | lifecycle | transition | single | single | write | effective-on |
| `Organization.Adjustment.Apply` | business-process | composed | single | single | mixed | effective-on, atomic only |
| `Organization.Person.TransferBatch` | business-object | mutation | single | batch | write | effective-on |

Bundle 可以增加 create/cancel/query 等辅助 Operation，但不得减少上述验证矩阵。

## Registry And Admission

- definition、preset、binding 通过现有 package public root 注册；server 只组合 trusted registration。
- handler 只按 `operation.ref` map 分发，不按五维或 timeline mode 实现大 switch。
- unknown ref 返回 `OPERATION_CATALOG_MISMATCH`；非法 request timeline 返回 `REQUEST_VALIDATION_FAILED`；definition/timeline mismatch 返回 path-aware catalog mismatch。
- preflight 在 compile/create/seed/handler 前完成。
- `Apply` definition 与 binding 只声明 `atomic`；跨 datasource 或 capability 不可用继续复用现有结构化拒绝。

## Workbench Authority

日期控件只做 exact request editor 的投影：

```text
preset.request -> JSON editor text -> derived timeline fields
date edit -> update parsed request.timeline -> replace JSON editor text
execute -> POST exact current editor text
```

页面不维护第二份 payload、subject、execution 或 timeline request。JSON 手工编辑后，控件重新从 editor parse 结果派生；非法 JSON/contract 只显示 diagnostics，不偷偷修复。

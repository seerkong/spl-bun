# Design: day timeline operation contracts

## 上下文

本 track 是 mission 的公共底座，只拥有 transport-neutral timeline declaration/admission 与 trusted runtime adapter。组织域如何存 temporal facts 由后续 bundle track 拥有。

## Timeline DTO

- Request `timeline` optional；definition `timeline` optional。
- Modes: `as-of`, `effective-on`, `range`；granularity 唯一值 `day`。
- Day 格式必须 canonical `YYYY-MM-DD` 且通过 Gregorian roundtrip。
- Optional `recordedAt` 必须为 UTC ISO instant；它只用于 read slice。Write handler 使用 context 的 system `recordedAt`，不得信任 request 值作为写入记录时间。
- Catalog match：definition 无 timeline 时 request 不得提供；required 时必须提供；mode/granularity 必须包含于 definition。

## Runtime Predicate Grammar

```ts
type RuntimeQueryPredicate =
  | { kind: "comparison"; field: string; operator: "eq" | "ne" | "lt" | "lte" | "gt" | "gte"; value: string | number | boolean }
  | { kind: "null"; field: string; operator: "is-null" | "is-not-null" }
  | { kind: "and" | "or"; predicates: readonly RuntimeQueryPredicate[] };
```

- Logical predicates must be non-empty.
- Existing `where` equality convenience remains and is ANDed with `predicate`。
- Field is a trusted model field identifier, not raw SQL fragment；value becomes `Literal`。
- Projection uses `ColumnRef`, `Comparison`, `IsNull`, `Logical.and/or` from declared public depa ORM subpaths.
- No raw SQL, function, join, alias, order, range shortcut or arbitrary operator.

depa ORM 0.2 的 public AST 能表达递归 OR，但 storage-neutral Reader admission 只执行 conjunction。Runtime 保留单一 immutable AST 投影作为语义 authority，并在实际 read boundary 同步建立 caller query 的 detached/frozen snapshot，把封闭 predicate 规范化为最多 64 个 DNF conjunction，在首次 `await` 前构造全部 immutable branch AST，通过 public Reader 分支执行，再按实体 primary key 去重和恢复 snapshot 中的所选字段。这样调用方不能在异步执行中篡改后续分支，每个分支仍由 `Literal` 参数化且不越过 public package boundary；不修改 `node_modules`，也不引入 adapter handle/raw SQL。真实 SQLite read 与 post-call mutation test 必须覆盖该 lowering，而不能只断言 AST shape。

双时间 predicate 由 consumer 组合：

```text
validFrom <= asOf
AND (validTo IS NULL OR validTo > asOf)
AND recordedFrom <= recordedAt
AND (recordedTo IS NULL OR recordedTo > recordedAt)
```

## Recorded Time Owner

`executeDomainOperation` 在 exact preflight 通过后、任何 compile/create/seed/handler 之前调用一次 runtime clock，转换为 UTC ISO string。该值进入同一个 execution closure 的 `DomainOperationHandlerContext.recordedAt`；`invokeChild` 复用 closure，不重新读 clock。测试可通过 non-transport `RuntimeExecutionControl.clock` 注入固定 clock，production 缺省系统时间；adversarial case 同时提供不同的 request `timeline.recordedAt`，证明它不能拥有 write timestamp。

## Effect Guard

Handler context 的 `write` 在进入 public Writer 前检查当前 definition 以及祖先 invocation chain 的 effect。任一祖先为 `read-only` 时，限制沿所有 child/grandchild 调用继承，并在整棵 invocation tree 共享的 runtime-owned sticky violation state 中记录首个 `READ_ONLY_OPERATION_WRITE_REJECTED`。即使 child 或 parent handler 捕获拒绝并尝试正常返回，runtime 在每层 handler boundary 都强制重新抛出该 violation；outer transaction 捕获并回滚，mutation facts 不得宣称 commit。`write`/`mixed` 保持现有路径。

Handler 调用 `context.read` 或 `context.write` 时，runtime 在入口、首次异步等待之前建立一次递归 detached/frozen snapshot。真实 Reader/Writer 委托、Writer observer、mutation summary 与 public plan 都只消费该同一份 snapshot；调用方即使在拿到 Promise 后、`await` 前篡改原 query/mutation，也不能制造“数据库事实正确但响应证据伪造”的分叉。

Non-transport `RuntimeExecutionControl.onWriterCall` 只观察已完成 mutation conversion 且实际调用 public Writer 的 snapshot。同步 throw 和异步 rejection 都被隔离。Allowed-write、conversion rejection、direct read-only、read-only-parent/write-child 和 post-call mutation tests 分别证明 observer 不能成为 Writer authority，且执行事实与公开证据一致。

## 影响范围

- `packages/domain-operation-contracts/src/index.ts`
- `packages/domain-operation-contracts/__tests__/request-contracts.test.ts`
- `packages/domain-operation-contracts/__tests__/response-contracts.test.ts`（仅 diagnostic literal set 如需要）
- `packages/depa-orm-domain-runtime/src/index.ts`
- `packages/depa-orm-domain-runtime/__tests__/public-boundary.test.ts`
- `packages/depa-orm-domain-runtime/__tests__/bundle-lifecycle.test.ts`
- `packages/depa-orm-domain-runtime/__tests__/registry-transaction.test.ts`
- `packages/depa-orm-domain-runtime/__tests__/temporal-runtime.test.ts`

## 风险与控制

| 风险 | 控制 |
| --- | --- |
| optional field 破坏 exact parser | root key allowlist 显式加入 + legacy fixtures |
| day validation 接受 normalization | regex + UTC component roundtrip |
| recordedAt 被 request 冒充 | request value 只读 slice；write 使用 context value |
| predicate 变成 SQL escape hatch | closed discriminated union + no RawSql import/test |
| public Reader 不支持 OR | bounded DNF lowering + primary-key dedupe + real SQLite read test |
| caller 在异步分支间篡改 query | read-entry detached/frozen snapshot + all ASTs before first await |
| caller 在 read/write await 期间篡改公开证据 | context-entry single snapshot 同时驱动 IO、observer、summary 与 plan + mutate-before-await tests |
| read-only child 绕过 parent boundary | read-only restriction 沿 invocation tree 继承 + child bypass test |
| handler 捕获拒绝后伪装成功 | invocation-tree sticky violation + direct/inherited swallowed-rejection tests |
| observer 影响执行或看到共享引用 | context-entry deep-detached frozen snapshot + sync/async error isolation |
| read-only guard 只报错但先写了 | guard 位于 Writer IO 前 + before/after/committed/zero-call evidence |

## 待解决问题

- None. Auto decisions 记录在 `decisions.xnl`。

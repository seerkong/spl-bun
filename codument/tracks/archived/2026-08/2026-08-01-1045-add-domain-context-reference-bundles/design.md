# Design: Reference Domain Context Bundles

## Package Boundary

`depa-data-domain-context-bundles` depends only on the public roots of
`depa-data-domain-operation-contracts` and `depa-data-depa-orm-domain-runtime`.
It exports immutable bundles, capabilities, and structurally plain
`{ bundle, capabilities }` registration values. It never imports web-server.

The root build orders bundles after runtime and before web-server. Only the
`import.meta.main` server startup path supplies reference registrations to
`createApp`; direct/test callers keep the empty default registry.

## Runtime Constraints

- Bundle shape is the live runtime API: `{ catalog, seed, bindings, probes }`.
- Semantic BO/association/lifecycle/constraint/process/capability entries live
  in `catalog.resources`.
- Association links are explicit Kon entities with scalar foreign ids because
  the current public compiler bridge rejects relation schemas.
- `RuntimeQuery` supports equality predicates. Selection handlers resolve
  `all`, `filter`, and `ids`, then perform public read/update calls themselves.
- Updates read the current complete row and write a full replacement including
  its primary key. Lifecycle guards run read-then-update inside the runtime's
  existing atomic transaction; no optimistic compare-and-set is claimed.
- `inputSchema` is catalog metadata. Handlers validate payloads at execution.
- Root-operation probes own observation coverage and read all affected entities;
  child probes do not run automatically.
- Constraint violations return successful structured outcomes such as
  `{ valid: false, code, subject }`; handler/runtime failures throw and become
  execution diagnostics.

## IT Asset Matrix

| Operation | Dimensions | Required behavior |
| --- | --- | --- |
| `ItAsset.Asset.Get` | business-object/query/single/single/read-only | BO query returning the seeded asset |
| `ItAsset.DamageCase.CancelRepair` | business-object/action/single/single/mixed | invokes four registered children in order |
| `ItAsset.DamageCase.QueryAssociatedAsset` | business-object/query/single/single/read-only | child reads linked asset |
| `ItAsset.DamageCase.ValidateLoanerReturned` | business-object/validate/single/single/read-only | child returns scalar/business evidence |
| `ItAsset.DamageCase.MarkCanceled` | business-object/mutation/single/single/write | standalone and child-callable mutation |
| `ItAsset.Asset.RestoreDamageState` | business-object/mutation/single/single/write | child restores asset state |
| `ItAsset.AssetCoveredByContract.Link` | association/mutation/single/single/write | creates explicit link entity |
| `ItAsset.AcceptanceProgress.Advance` | lifecycle/transition/single/single/write | read guard then progress update |
| `ItAsset.PurchaseSourceMustExist.Validate` | constraint/validate/single/single/read-only | valid/violation structured outcomes |
| `ItAsset.ReturnOrderLine.MarkReinbounded` | business-object/mutation/single/single/write | registered ReturnReinbound child updates the line |
| `ItAsset.ReturnReinbound.Execute` | business-process/composed/single/single/mixed | invokes `ItAsset.ReturnOrderLine.MarkReinbounded` |
| `ItAsset.DisposalApplication.ScrapAndDispose` | business-object/action/single/single/mixed | validates payload and performs registered extension behavior |

CancelRepair success tree is exactly:

```text
CancelRepair
  -> QueryAssociatedAsset
  -> ValidateLoanerReturned
  -> MarkCanceled
  -> RestoreAssetDamageState
```

The failure preset uses a case whose loaner is not returned; the first two
children remain visible and no writes commit.

## Commerce Matrix

| Operation | Dimensions | Required behavior |
| --- | --- | --- |
| `Commerce.DomainInventorySummary` | domain-context/computed/none/single/read-only | composite counts from the context |
| `Commerce.Order.ArchiveEligible` | business-object/mutation/selection/single/write | filter and ids selectors remain one invocation |
| `Commerce.Order.CorrectOwner` | business-object/mutation/single/batch/write | atomic and best-effort independent keyed items |
| `Commerce.Order.Query` | business-object/query/selection/single/read-only | registered BO query resolves the requested orders |
| `Commerce.OrderOverview` | capability/composed/selection/single/read-only | invokes `Commerce.Order.Query` and a registered raw query |
| `Commerce.ImpactAnalysis` | raw/query/none/single/read-only | graph outcome |
| `Commerce.OwnershipTree` | raw/query/none/single/read-only | tree outcome |
| `Commerce.RiskHotspot` | raw/query/none/single/read-only | table outcome |
| `Commerce.IngestBatch` | raw/raw/none/single/write | payload batch is one atomic invocation, composite outcome |

## Presets And Evidence

Every operation definition has at least one complete preset. Additional
presets cover CancelRepair success/failure, constraint valid/violation,
selection filter/all/ids, batch atomic/best-effort partial, and ingest payload
batch. The `all` preset remains `mode=single`, performs an unfiltered public
read, deterministically resolves eligible rows, and applies one shared payload.
Matrix tests execute through `loadDomainContextBundle` and
`executeDomainOperation`, never call handlers directly, and assert:

- outcome variant and business values;
- requested/committed atomicity and per-write mutation summaries;
- before/after/diff from root probes;
- registered child operation tree and public plan;
- failure diagnostics and rollback/no-handler facts where applicable;
- deterministic sequential and concurrent fresh state.

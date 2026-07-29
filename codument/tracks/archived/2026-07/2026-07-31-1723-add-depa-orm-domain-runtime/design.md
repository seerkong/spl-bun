# Design: Depa ORM Domain Runtime

## Context

The accepted mission contract now exists independently of transport and
database code. G5 must provide the execution authority behind that contract
while preserving two hard boundaries:

- `packages/depa-orm-capsule` is evidence only and remains user-owned future
  work.
- Production code may use only declared package exports from depa-orm.

The archived `align-domain-operation-preset-contract` correction is a hard
prerequisite. Runtime consumes its complete `OperationPresetDto.request`,
required definition verb/requestable capabilities, exact parser, and
catalog/preset matchers as authorities. It does not preserve or reconstruct
the retired shadow DTO.

The current depa-orm packages contain a transitional split. The public Kon
compiler result still describes the older halfcode schema, while the public
compose/assemble facade consumes the new storage-neutral schema. Also, the
Reader's installed runtime currently consumes query value classes exposed via
the package export map rather than the newer root `SelectQuery`. The runtime
therefore owns an explicit compatibility adapter, guarded by tests, instead of
pretending the two generations are assignment-compatible.

## Dependency And Import Boundary

Package: `packages/depa-orm-domain-runtime`

Name: `depa-data-depa-orm-domain-runtime`

Declared dependencies:

- `depa-data-domain-operation-contracts: workspace:*`
- `depa-orm-engine-contract: 0.1.0`
- `depa-orm-engine-logic: 0.1.0`
- `depa-orm-engine-assemble: 0.1.0`
- `depa-orm-engine-support-sqlite: 0.1.0`
- `depa-orm-dsl-kon: 0.1.0`

Root package imports are the default. The only allowed depa-orm subpaths are
the export-map query constructors required by the actual Reader:

- `orm/query/value/select-query`
- `orm/query/value/query-field`
- `orm/query/value/clause/from-clause`
- `orm/query/value/clause/select-clause`
- `orm/query/value/clause/where-clause`
- `orm/query/ast/sql-expression-ast`

The boundary guard rejects `halfcode`, `dist`, `node_modules`,
`depa-orm-capsule`, source-relative external repository imports, and any other
depa-orm subpath.

## Model Bridge

`compileRuntimeModel(modelSources)`:

1. Accepts frozen catalog model sources whose content is a string and whose
   kind denotes Kon.
2. Combines them with stable source provenance and calls the compiler from the
   `depa-orm-dsl-kon` root.
3. Rejects compiler errors as structured initialization diagnostics.
4. Reads only public result properties and explicitly creates current root
   `DataSourceRef`, `OrmFieldSchema`, and `OrmEntitySchema` objects.
5. Builds matching public SQLite entity registrations.
6. Rejects model features that cannot be projected truthfully in v1 rather than
   importing halfcode. Reference bundles may represent associations as explicit
   entities.

The adapter maps field kind, column name, nullability, primary key, and caller
key generation. No legacy schema object enters compose/assemble.

## Query DTO Adapter

Handlers use a transport-neutral query DTO:

```ts
interface RuntimeQuery {
  readonly entity: string
  readonly fields: readonly string[]
  readonly where?: Readonly<Record<string, JsonPrimitive>>
}
```

The adapter constructs the allowlisted immutable query value objects. Multiple
`where` entries become an AND of equality comparisons. It exposes JSON rows to
trusted handlers but does not expose query classes through HTTP or contracts.

## Bundle Authoring Contract

```ts
interface DomainContextBundle {
  readonly catalog: DomainContextAuthoringCatalog
  readonly seed: readonly RuntimeMutation[]
  readonly bindings: readonly DomainOperationBinding[]
  readonly probes: readonly DomainObservationProbe[]
}
```

`DomainContextAuthoringCatalog` is the static bundle shape:
`Omit<DomainOperationCatalog, "capabilities">`. It owns read-only model
sources, semantic resources, Operation definitions, and complete presets.
The server-current `DomainOperationCapabilities` projection is injected by
server composition and is never persisted into the authoring bundle.

Runtime-only bindings are trusted package code and own an explicit actual
capability set:

```ts
interface OperationActualCapabilities {
  readonly atomicity: readonly ExecutionAtomicity[]
  readonly observations: readonly ObservationChannel[]
}

interface DomainOperationBinding {
  readonly operationRef: string
  readonly dataSourceKeys: readonly string[]
  readonly capabilities: OperationActualCapabilities
  readonly handler: DomainOperationHandler
  readonly requiresRowLevelMapping?: boolean
}
```

Bundles may register model, seed, handlers, and probes. They cannot replace the
compiler bridge, lifecycle, transaction policy, registry algorithm, response
normalization, or cleanup mechanism.

The loader validates unique ids/refs, every complete preset through the exact
parser and preset/catalog matcher, one-definition batch verb/subject shape,
definition/binding capability compatibility, model source shape, datasource
references, and handler/probe uniqueness. It freezes the original preset
request structure and values without decomposing or rebuilding them. It stores
no server-current projection, connection, database, transaction, mutable
handler state, or last response.

## Handler Context

A handler receives one invocation plus a controlled context:

- immutable operation/request/subject/payload facts;
- `read(RuntimeQuery)` and `write(RuntimeMutation)` adapters;
- `invokeChild(operationRef, invocation)` for composed operations;
- helpers to return a contract `OperationOutcome` and mutation summaries.

Read/write helpers capture public plan kind, datasource key, and stage ids.
They never expose an adapter handle or SQL.

## Lifecycle

`executeDomainOperation(bundle, unknownRequest, serverCapabilities)` owns:

1. `preflight`: parse the exact request, validate catalog/preset parity and
   one-definition batch shape, locate the binding, and require the request
   choice to be supported by `definition requestable ∩ binding actual ∩ server
   current`. This stage allocates no SQLite, runs no seed, and invokes no
   handler.
2. `create`: allocate an execution id and local collectors only after
   preflight succeeds.
3. `initialize`: compile the read-only model, create one
   in-memory SQLite storage per datasource, initialize schema, compose and
   assemble depa-orm.
4. `seed`: group seed mutations by datasource and execute each group inside a
   public atomic transaction.
5. `execute`: invoke the operation-ref registry using the preflight result.
6. `observe`: capture requested probes and derive before/after/diff.
7. `destroy`: always destroy the SQLite registry in `finally`; convert cleanup
   failures into stable diagnostics.

The function returns only after destroy has completed. Trace stages include the
full allocated-resource lifecycle so tests can prove cleanup happened before
return. A preflight failure returns structured diagnostics with explicit
evidence that create/initialize/seed/handler did not run.

## Dispatch And Transactions

Registry lookup is `operation.ref -> binding`. The five dimensions are used for
catalog match and capability interpretation, never as an execution switch.

Capability facts remain orthogonal:

```text
effective support =
  definition requestable
  ∩ binding actual
  ∩ server current
```

The request `execution.atomicity` and every requested observation must belong
to the effective set. A failure at any one layer is reported before resource
allocation. The runtime never writes the intersection or server projection
back into the bundle and never derives a hidden default.

- `atomic` with exactly one datasource opens a public outer
  `OrmStorage.withTransaction("atomic")`. Nested Writer calls remain in that
  boundary.
- `atomic` with more than one datasource returns
  `CROSS_DATASOURCE_ATOMICITY_REJECTED` before a handler runs.
- Atomic child invocation must remain on the outer datasource; otherwise it is
  rejected.
- `best-effort` batch first proves every item has the definition verb and
  subject shape, then executes each item independently, catches item failures,
  and preserves item keys and statuses.
- Invocation-level mapping may be available. A binding that requires storage
  row-level mapping fails capability validation with
  `BATCH_ITEM_MAPPING_UNAVAILABLE`.
- Requested SQL observation produces `SQL_TRACE_UNAVAILABLE` and no SQL data
  until a stable public effect exists.

Atomic requests are never silently downgraded.

## Observations And Response

Probe capture is trusted bundle code using the controlled read helper. Requested
before and after snapshots are grouped by probe key. Diff is derived from those
JSON values. Handler read/write operations contribute public operation-tree
nodes, plan steps, stages, and mutation summaries.

Responses use the contract envelope:

- `success`, `partial`, or `failure`;
- normalized outcome;
- requested/committed atomicity and invocation-level batch mapping;
- before/after/diff/probes;
- operation tree, public plans/stages, no fabricated SQL;
- validation, capability, execution, and cleanup diagnostics.

## Verification Strategy

- Public bridge write/read smoke in the package's own dependency environment.
- Import guard scans source and package dependencies.
- Loader rejects duplicate/unknown refs, malformed complete presets, preset
  parity mismatches, and invalid binding capability subsets without allocating
  resources.
- Static bundle catalog stays unchanged when a server projection is injected;
  preset requests remain structurally and semantically unchanged from load
  through execution.
- Definition, binding, and server capability failures each prove zero SQLite,
  seed, and handler side effects.
- Mixed batch verb/subject requests fail preflight; homogeneous best-effort
  batches retain independent values, payloads, keys, and outcomes.
- Consecutive and concurrent executions begin from deterministic seed.
- Injected compile, seed, handler, observation, and cleanup failures prove
  `destroy` completion.
- Atomic composed writes roll back together; best-effort batch preserves
  successful siblings.
- Cross-datasource atomic handlers never run.
- Child operation tree, plans/stages, probes/diff, mapping and SQL diagnostics
  round-trip as JSON.

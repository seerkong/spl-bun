# Proposal: Depa ORM Domain Runtime

## Goal

Create `depa-data-depa-orm-domain-runtime` as the production runtime that turns a
trusted, read-only DomainContext bundle plus an execute request into an
isolated depa-orm/SQLite execution and a normalized Domain Operation response.

The archived `align-domain-operation-preset-contract` track is a hard
prerequisite. Runtime consumes its complete preset request, static verb,
closed requestable capability set, exact parser, and catalog/preset matchers
without reconstructing a compatibility model.

## Scope

- Define bundle authoring interfaces for a static catalog, model sources, seed
  DTOs, operation bindings with actual capability sets, handlers, and
  observation probes. Server current capability projection is injected at
  composition/execution time and is not stored as bundle truth.
- Compile read-only Kon model sources through the public compiler and explicitly
  project the public result into current storage-neutral depa-orm contracts.
- Assemble public depa-orm Reader/Writer and an in-memory SQLite registry for
  every execution.
- Adapt JSON query DTOs to the currently supported public query value exports.
- Load and validate bundles without retaining execution state. Preserve each
  complete preset request byte-for-byte-equivalently through load, preview,
  and execute.
- Run exact request, preset/catalog parity, one-definition batch homogeneity,
  and definition/binding/server capability-intersection preflight before
  allocating SQLite, seeding, or invoking a handler.
- Dispatch handlers by stable `operation.ref`, normalize single/selection/batch
  invocation, and preserve child operation trees.
- Enforce request choices against `definition requestable ∩ binding actual ∩
  server current`, same-datasource atomic execution, cross-datasource atomic
  rejection, and homogeneous best-effort batch isolation.
- Seed, execute, observe, and destroy resources with cleanup on every failure
  path.
- Produce outcomes, effects, before/after/diff probes, public plan/stages, and
  stable capability/cleanup diagnostics.
- Add package-boundary guards, lifecycle/isolation tests, declaration build,
  and root build integration.

## Hard P0 Gate

The first phase must prove all of the following from the new production package
itself:

1. Declared package dependencies resolve by public package name after a root
   install, without using `packages/depa-orm-capsule` or its `node_modules`.
2. Source imports contain no `halfcode`, `dist`, `node_modules`, capsule path,
   or undeclared depa-orm subpath.
3. A read-only Kon source compiles through `depa-orm-dsl-kon`; an explicit
   field-by-field adapter projects it to the current root storage-neutral
   contract without casting legacy schema objects.
4. Public compose/assemble/SQLite/Writer plus an allowlisted exported query
   value path perform a real in-memory write and read.

If this gate cannot pass, implementation stops and the mission must replan a
`depa-orm` library track. It is forbidden to weaken the gate with a cast or
private import.

## Out Of Scope

- Reference business bundles or business-specific handlers.
- Server routes, request transport, Vue/UI, or online Kon editing.
- Cross-datasource distributed transactions.
- Raw SQL construction or access to SQLite/native driver handles.
- Storage row-level mapping or SQL trace claims unsupported by public APIs.
- Changes to `packages/depa-orm-capsule` or the external depa-orm repository.
- Reconstructing preset requests, storing server current capabilities in
  authoring bundles, or deriving hidden capability defaults.

## Success Criteria

1. P0 public bridge and dependency gate passes from the runtime package.
2. Consecutive and concurrent executions use distinct seeded SQLite state and
   clean up after initialize/seed/handler/probe failures.
3. Registry dispatch is keyed by operation ref and rejects unknown, exact,
   preset/catalog, mixed-batch, or capability-intersection mismatches before
   any database, seed, or handler side effect and without a five-dimensional
   execution switch.
4. Same-source atomic composition rolls back together; cross-source atomic is
   rejected before handlers; homogeneous best-effort batch preserves
   independent item status.
5. Responses truthfully expose operation tree, plans/stages, effects,
   before/after/diff, and unavailable mapping/SQL diagnostics.
6. Bundle load preserves the complete preset request unchanged, and static
   bundle facts remain separate from server current projection.
7. Focused tests, declaration build, root build, and public import guard pass.

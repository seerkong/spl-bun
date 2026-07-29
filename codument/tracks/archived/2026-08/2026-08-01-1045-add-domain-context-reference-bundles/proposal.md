# Proposal: Reference Domain Context Bundles

## Goal

Create `depa-data-domain-context-bundles` with two deterministic, runnable domain
contexts that prove the Domain Operation model against real relational state
rather than a single BO Action fixture.

## Scope

- `it-asset-lifecycle`: BO query/action/mutation, explicit CancelRepair child
  tree, association mutation, lifecycle transition, constraint validation,
  business-process composition, and the ScrapAndDispose extension action.
- `commerce-operations`: domain-context computed operation, selection mutation,
  independent batch mutation, capability composition, and raw graph/tree/table
  reads plus raw ingest write.
- Read-only Kon model sources, semantic resources in `catalog.resources`, exact
  complete presets, deterministic seed, public runtime bindings, and probes.
- Success, business-violation, execution-failure, filter/ids selection,
  atomic/best-effort batch, and composed child-tree scenarios.
- Public package/import guards, complete operation-matrix tests, server catalog
  integration, production server startup registration, and root build.

## Out Of Scope

- UI, online Kon editing, uploaded code, SQL trace claims, and persistent state.
- Native Kon relation schema support; association facts use explicit entities
  with scalar ids until the public model bridge supports relations.
- Engine-level optimistic compare-and-set lifecycle guarantees.
- Changes to `packages/depa-orm-capsule/` or private depa-orm imports.
- Changing the empty default of `createApp()`.

## Success Criteria

1. Both bundles pass loader and exact preset/catalog validation and expose no
   server or execution state.
2. Every normative operation shape in the mission baseline has at least one
   executable preset with truthful outcome/effects/observations/trace.
3. Selection remains one invocation for filter and ids selectors; batch keeps
   independent keys and statuses.
4. CancelRepair and other composed operations preserve registered child refs;
   parent probes observe every affected table.
5. Sequential/concurrent execution starts from deterministic seed; business
   violations remain structured outcomes and thrown failures remain diagnostics.
6. Production server startup registers both bundles while `createApp()` remains
   empty by default; tests, builds, guards, and capsule manifests pass.

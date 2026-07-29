# Adopt Live Event Operations Reference Domain

## Why

The first Domain Workbench reference context currently carries recognizable source-domain vocabulary. The workbench needs a neutral example that demonstrates the same mechanisms without presenting that source as the product's reference identity.

## Goal

Replace the first production reference context with `event-operations-lifecycle`, titled `Live event operations`, while preserving the complete executable Operation matrix and all current runtime, HTTP, observation and browser guarantees.

## Non-Goals

- Do not change the Operation contract, runtime lifecycle, server routes or Workbench interaction model.
- Do not change `commerce-operations` behavior.
- Do not add online Kon editing or compilation.
- Do not rewrite archived Codument tracks, missions, decisions or reports.
- Do not modify or test `packages/depa-orm-capsule/`.

## Changes

- Replace the first bundle's id, version, title, Kon model, semantic resources, seed data and catalog identity.
- Replace all 12 definitions and their presets with the frozen `EventOps.*` matrix in `design.md`.
- Preserve the four-child composed Action, atomic rollback, independent mutations, Association, Lifecycle, Constraint, BusinessProcess and extension Action behavior.
- Rename package test files/helpers and migrate server and Workbench E2E assertions.
- Update live behavior registries through behavior deltas at archive time.
- Prove that current non-archived product truth no longer exposes the retired example identity or vocabulary.

## Success Criteria

1. The two production contexts are `event-operations-lifecycle` and `commerce-operations`.
2. EventOps provides exactly the same 12-operation dimension/behavior coverage as the replaced bundle.
3. CancelEvent exposes four registered children in exact order, commits on success and rolls back on validation failure.
4. Association, lifecycle, constraint, process and extension operations mutate/read real relational state with truthful before/after/diff/tree/diagnostic evidence.
5. Complete preset requests remain catalog-matched and are posted unchanged by the Workbench.
6. Bundle/server/IDE focused tests, root build and Chromium E2E pass.
7. Current live source, tests and promoted behaviors contain no retired first-domain references; historical archives remain unchanged.
8. `packages/depa-orm-capsule/` remains untouched.

## Impact

This is a breaking change only for consumers that hard-code the previous reference bundle id, preset keys, model entities or operation refs. The public contract and server route shapes do not change.

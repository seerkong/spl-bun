# Proposal: Domain Operation Contracts

## Goal

Create `depa-data-domain-operation-contracts` as the transport-neutral owner of
DomainContext catalog and Operation execution JSON contracts.

The package makes the mission's five-dimensional Operation model executable as
a stable TypeScript and runtime-validation boundary shared by the future
runtime, server, reference bundles, and workbench UI.

## Scope

- Define JSON-compatible catalog, request, response, and capability DTOs.
- Freeze the orthogonal `owner`, `behavior`, `subject`, `invocation`, and
  `effect` dimensions.
- Keep `atomicity` as an independent execution constraint.
- Model `selection` as one logical invocation and `batch` as multiple
  independently keyed invocations.
- Parse unknown JSON into an execute request with structured validation errors.
- Compare a request's declared Operation dimensions with a catalog definition.
- Define normalized outcomes, effects, observations, trace, diagnostics, and
  stable capability diagnostic codes.
- Add representative fixtures, compatibility tests, declaration build, and
  root build integration.

## Out Of Scope

- Runtime normalization, target resolution, handler dispatch, selector
  expansion, batch scheduling, transactions, and resource lifecycle.
- Elysia routes, Vue state, workbench views, SQLite, Kon compilation, or any
  `depa-orm` implementation dependency.
- Changes to `packages/web-shared`.
- Claims that cross-datasource atomicity, row-level storage mapping, or SQL
  trace are supported.
- Business-specific fields from example bundles in the generic contract.

## Success Criteria

1. The public package exports JSON-safe DTOs and literal value sets for all
   accepted Operation dimensions.
2. Single, selection, and batch request fixtures round-trip through JSON and
   unknown-input validation without semantic ambiguity.
3. Invalid structures and request/catalog mismatches produce deterministic,
   path-aware diagnostics.
4. Responses represent all required outcome variants plus effects,
   observations, trace, and diagnostics.
5. Package tests, declaration build, and the root build pass without importing
   forbidden runtime or UI dependencies.

## Authorization

This track is a planned child of mission `depa-orm-domain-workbench`. The
user's explicit invocation of `codument-impl-mission` authorizes autonomous
planning and execution within the accepted mission design.

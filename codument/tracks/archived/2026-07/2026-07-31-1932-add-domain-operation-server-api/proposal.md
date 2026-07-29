# Proposal: Domain Operation Server API

## Goal

Expose the completed Domain Operation contract and runtime through a stable
Elysia API in `depa-data-web-server`, while preserving the exact preset request,
per-execution isolation, and the separation between authoring facts and server
current capabilities.

## Scope

- Register trusted `DomainContextBundle` values through `createApp` options.
- Load each registration once, reject duplicate `context.id`, and freeze the
  registration's server-current capability projection.
- Add catalog, operation, preset, and unified execute routes.
- Return explicit public catalog projections without exposing bundle seed,
  handlers, bindings, probes, execution state, or database resources.
- Route the original parsed execute body to `executeDomainOperation` after
  resolving its context.
- Normalize transport-side validation and lookup failures into the public
  `ExecuteOperationResponse` contract with truthful nullable facts.
- Preserve the existing health and SPL `execute-kon` APIs.
- Add direct `app.handle` integration tests, a package build/typecheck, root
  build integration, and source/import boundary guards.

## Out Of Scope

- Production reference/business bundles; G6 uses only a server-local fixture.
- Domain Workbench UI or online Kon editing.
- A second DTO/schema authority in `web-shared`.
- Live database ownership in the server or persistence between requests.
- Multiple concurrently active versions for one context id.
- Changes to `packages/depa-orm-capsule/` or private depa-orm imports.

## Success Criteria

1. All five Domain Operation routes expose only contract-owned JSON DTOs and
   use a single loaded registration per context id.
2. A preset request can be fetched and posted unchanged; valid domain outcomes
   use HTTP 200, while missing catalog resources use one stable HTTP 404 shape.
3. Invalid/missing context facts and unknown id/version return stable contract
   diagnostics without selecting a fallback bundle or allocating runtime state.
4. Sequential and concurrent calls remain isolated through runtime ownership.
5. Existing web-server behavior, focused tests, typecheck/build, root build,
   and package-boundary guards pass.
6. The protected capsule regular-file and direct-symlink hashes remain
   `342acb95e757be6ee64afc7a044414c22a8efbb2c3fcafd998ccf3796bf2d4f1`
   and `f8c0e2aac9731320bdf7292087e9a84da4d8caaaec37a3573c331158f49364fa`.

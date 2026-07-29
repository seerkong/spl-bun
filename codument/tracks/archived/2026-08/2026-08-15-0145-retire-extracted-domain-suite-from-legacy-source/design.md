# Design

## Ownership cut

The extracted Domain Suite is now authoritative in the sibling `depa-domain-suite.ts` repository and its public npm packages. This repository does not consume those packages in production and does not retain a compatibility facade; it becomes source-only for its language/data capabilities.

## Package retirement

The four retired Domain package directories and their root build/reference entries are removed as one unit. Tests and fixtures owned only by those packages are removed with them. Remaining packages must have no dependency edge to the retired package identities.

## Web narrowing

`web-server` remains a private executable for Kon/SPL demos. Its Domain registrations and canonical Domain routes are removed, while health/CORS/demo-data initialization and `/api/execute-kon` remain.

`web-ide` remains a private Kon IDE. Router and shell are simplified to the Kon page; the Domain Workbench page, client, observation/request utilities, components, unit tests, and E2E are deleted. Kon desktop/browser behavior remains the regression authority.

## Current knowledge cleanup

Current behavior registries and durable decisions that assert ownership of the retired Domain capabilities are removed. A new `source-only-scope` behavior becomes the positive owner boundary. Immutable archive history may remain but must not be imported as current authority.

## Verification

Verification covers:

- exact remaining workspace identities and dependency graph;
- full `bun test`, build, package typechecks, real Kon server smoke, and Kon Playwright E2E;
- zero production/current-owner residue for retired package names, Domain routes/registrations/reference bundles, and Domain Workbench UI;
- positive retention proofs for core/expression/spl-flow/sqlite/Kon DSL/composer/web-shared/Kon Web server and IDE.

# Retire extracted Domain Suite from the legacy source

## Goal

Remove the Domain Operation protocol, depa-orm Domain runtime, Elysia Domain server adapter, reference Domain contexts, and Domain Workbench demo surfaces now owned by `depa-domain-suite.ts`, while preserving this repository's source-language and data-processing capabilities.

## Remove

- `packages/domain-operation-contracts`
- `packages/depa-orm-domain-runtime`
- `packages/domain-operation-server`
- `packages/domain-context-bundles`
- Domain catalog/execute composition and tests from `packages/web-server`
- Domain Workbench route, client, components, utilities, unit tests, and E2E from `packages/web-ide`
- Root scripts, TypeScript references, fixtures, current behaviors, current decisions, and orphaned active evidence that still claim Domain Suite ownership

## Preserve

- expression, core, spl-flow, sqlite-adapter, test-utils
- kon-spl-dsl and its source execution facade
- depa-orm-capsule source/code-first integration
- composer and web-shared
- Kon-only web-server `/api/execute-kon`
- Kon-only Web IDE, demos, and Playwright coverage
- immutable archived tracks/decisions as historical evidence unless they participate in current ownership

## Success

The complete repository test/build/typecheck/Kon E2E matrix remains green, the remaining Web product exposes only Kon execution, and production/current-authority scans contain no retired package, Domain route, context bundle, or Domain Workbench owner.

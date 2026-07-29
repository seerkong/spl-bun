# Change: Bootstrap SPL Bun monorepo with SQLite core support

## Why
- Reimplement esProc in a Bun-based, multi-package monorepo to simplify JavaScript/TypeScript development and faster iteration.
- Deliver a minimal core compute/orchestration engine plus SQLite data source support before tackling other connectors.

## What Changes
- Scaffold a new `spl-bun/` Bun workspace with shared tooling and package scripts for install, test, and build (TypeScript only; no linting in v1).
- Define packages for the core SPL execution/runtime engine, SQLite adapter, and a thin integration/test harness to exercise scenarios.
- Specify initial SPL execution semantics (cell/step evaluation, datasets, set-style operations) sufficient to run SQLite-backed flows, limited to projection/filter/aggregate operators in the first cut.
- Add SQLite connector capabilities (open database file/URI, parameterized queries, streaming rows into datasets, error surfacing).
- Establish automated tests and fixtures that validate the core engine and SQLite integration under Bun.
- Preserve naming and directory structure parity with the original esProc where practical (file/package/class names) to ease cross-referencing during the port.

## Impact
- Affected specs: spl-bun-monorepo, spl-core-engine, sqlite-adapter, spl-test-harness
- Affected code: new `spl-bun` workspace manifests/scripts, core runtime package, SQLite adapter package, shared test utilities/fixtures.

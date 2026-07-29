# Change: Add join and window operations to SPL Bun core

## Why
- The current TypeScript SPL core only supports projection/filter/aggregate; esProc uses join and window operations extensively.
- Enabling join/window parity improves compatibility with original esProc behavior and unlocks richer analytics on SQLite-backed datasets.

## What Changes
- Extend the core dataset/runtime to support configurable joins (inner/left) across datasets with column/key selection and conflict resolution.
- Introduce window functions (partition/order frames) for common analytics (row_number, rank/dense_rank, running sums/averages) on datasets.
- Update execution semantics so join/window can be used as steps in scripts, with clear error reporting.
- Expand tests/fixtures to cover join/window behavior, including SQLite-fed datasets.

## Impact
- Affected specs: spl-core-engine (new join/window requirements), spl-test-harness (new coverage expectations).
- Affected code: `spl-bun/packages/core` runtime APIs and transformations; tests in `packages/core` and integration tests using SQLite fixtures.

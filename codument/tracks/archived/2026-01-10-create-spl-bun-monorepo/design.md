# Design

## Scope
Bootstrap a Bun monorepo (`spl-bun/`) that reimplements esProc core compute/orchestration engine with an initial SQLite data source. Favor minimal, testable slices over completeness. Use TypeScript across packages; omit linting in v1.

## Package layout (proposed)
- `spl-bun/package.json` (workspace root): bun workspaces, shared scripts (`bun test`, `bun run build`), devDeps. TypeScript config at root; no lint tooling in v1.
- `packages/core`: core SPL runtime in TypeScript. Provides dataset/table abstractions, execution context, step/cell evaluation, and core set-style operators (projection, filtering, aggregation; joins/windowing later).
- `packages/sqlite-adapter`: SQLite connector using Bun sqlite bindings; exposes query execution, parameter binding, streaming rows into core datasets, and metadata/errors.
- `packages/test-utils` (optional if needed): shared fixtures/helpers for tests (SQLite sample db creation, dataset comparisons).
- Prefer preserving naming and directory structure parity with the original Java sources (class/module naming) where it does not conflict with TypeScript/Bun conventions.

## Execution model (initial)
- Scripts represented as ordered steps; each step can reference prior step outputs by name/index, similar to esProc grid evaluation but simplified to linear evaluation.
- Dataset abstraction supports row iteration, schema (column names/types), basic transformations limited to projection/filter/aggregate in v1, and materialization to arrays for assertions.
- Error model: steps fail fast with surfaced context (step id, source op, underlying adapter errors). Adapter errors are wrapped with source info.

## SQLite integration
- Adapter opens a file/URI, prepares statements, supports parameter binding, and yields rows as iterators/streams convertible to core datasets.
- Integration layer bridges adapter result sets into core datasets and allows execution steps like `loadSqlite({ dbPath, sql, params })` followed by dataset operations.

## Testing strategy
- Use `bun test` across workspace.
- Provide fixtures to create temporary SQLite DBs with seed data before tests; clean up after.
- Tests to cover: core dataset transforms, step dependency wiring, SQLite query fetch, parameter binding, and error propagation.

## Out-of-scope (for this change)
- Non-SQLite adapters (Postgres, MySQL, file formats).
- Full esProc grid UI/editor; focus purely on runtime/engine semantics.
- Advanced SPL features (graph algorithms, complex windowing, joins) beyond the minimal operator set noted above.

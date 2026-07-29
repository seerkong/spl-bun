# Design

## Scope
Add join (inner/left) and window operations to the SPL Bun core dataset/runtime so scripts can express common relational and analytic computations. Maintain TypeScript style, no linting, and align naming/structure with original esProc concepts where practical.

## Join design
- Operators: inner join and left join for v1; allow specifying join keys (explicit column list) and optional select/project of columns to avoid name collisions.
- Schema merge: prefix or disambiguate duplicate column names (e.g., suffix with source alias) and document behavior; null-fill for unmatched left rows.
- Execution: operate on in-memory datasets; stable ordering not guaranteed unless specified by caller.
- Error handling: missing keys or incompatible schemas raise step-context errors with source labels.

## Window design
- Functions: row_number, rank, dense_rank, running_sum, running_avg (over single numeric column), applied per partition with ordering.
- Window spec: partitionBy (columns), orderBy (columns asc/desc), optional frame defaults to unbounded preceding to current row for running metrics.
- Output: append computed window columns to the dataset schema.
- Error handling: invalid window definitions (missing order for ranking) raise explicit errors; non-numeric inputs for running aggregates fail with context.

## Execution integration
- Add step definitions for join/window that consume prior step datasets; errors propagate via existing StepError surface.
- Keep API surface minimal: e.g., dataset.join(other, spec) and dataset.window(spec) returning new datasets; expose helpers for step wiring if needed.
- Preserve naming parity with esProc where feasible (e.g., method names reflecting join/window semantics) without breaking TS conventions.

## Testing strategy
- Unit tests in `packages/core` covering join variants (inner/left, key mismatch, duplicate columns) and window functions with partition/order cases.
- Integration tests using SQLite fixtures to ensure adapter-fed datasets participate correctly in join/window operations.
- Continue running `bun test` workspace-wide.

## Out-of-scope
- Full outer/right joins, semi/anti joins, complex window frames (e.g., range-between), and custom window functions beyond the listed set.
- Query pushdown to SQLite; joins/windows are in-memory in this change.

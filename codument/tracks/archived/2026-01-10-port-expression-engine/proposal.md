# Change: Port expression engine to Bun/TypeScript

## Why
- Current Bun/TypeScript runtime lacks the esProc expression parser/evaluator; filters and computations require custom JS functions and are not syntax-compatible with the Java implementation.
- Porting the core expression semantics unlocks compatibility with existing esProc scripts and enables richer computed fields for dataset operations and step orchestration.

## What Changes
- Introduce a TypeScript expression module mirroring key structures from `com.scudata.expression` (AST nodes, operators, function library) in an appropriate `spl-bun` package while retaining familiar class/file names where practical.
- Wire expression evaluation into dataset/engine flows (filter/aggregate/join/window and step parameters), with null/undefined semantics and error context consistent with esProc.
- Port and extend expression test cases plus usage docs/examples to cover arithmetic, comparisons, logical operators, function calls, and integration with dataset rows.

## Impact
- Affected specs: spl-core-engine, spl-test-harness.
- Affected code: new expression package (e.g., `packages/expression` or `packages/core/src/expression`), dataset/engine adapters, fixtures/tests/docs under `spl-bun/`.

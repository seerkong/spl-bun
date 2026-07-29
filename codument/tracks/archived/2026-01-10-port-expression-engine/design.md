## Context
Port the legacy Java expression engine (`com.scudata.expression`) into the Bun/TypeScript monorepo so dataset operations and step orchestration can accept esProc-compatible expressions instead of ad-hoc JS callbacks. The Java source is large (AST nodes, operator classes, broad function library). We will deliver a first-cut that supports the operators/functions needed for dataset filter/aggregate/join/window and step parameters, while keeping class/file naming close for easier diffing.

## Goals / Non-Goals
- Goals: TypeScript expression parser/evaluator with AST nodes, operators (+, -, *, /, %, comparisons, logical, assignment), literals, variable resolution against row/step context, and a starter function set (math, string, datetime, collection helpers) matching esProc behavior where feasible; pluggable function registry; errors annotated with expression/position.
- Goals: Preserve recognizable structure/names from Java (Node, Operator, FunctionLib analogs) and support integration with dataset operations and engine steps.
- Non-Goals: Port UI/canvas/channel/vdb-specific functions, cellset/grid UI bindings, or JVM-specific utilities in the first cut; no linting; no security sandboxing beyond current runtime.

## Decisions
- Package placement: create a dedicated package (e.g., `packages/expression`) consumed by `depa-data-core` to keep concerns isolated while allowing reuse; mirror Java folder layout under `src/expression/...` to preserve names.
- AST & tokenizer: implement a small recursive-descent parser (tokens for identifiers, literals, operators, delimiters) to build Node/Operator objects; avoid runtime `eval`; support expression strings and pre-parsed nodes for reuse.
- Semantics: align null/undefined handling with esProc (null-propagation for arithmetic, equality treats null distinct unless both null, logical short-circuit); retain operator precedence from Java tables.
- Function library: port a focused subset first (math: abs/pow/sqrt; string: len/substr/upper/lower/trim; datetime: now/dateadd/datediff/format; collection: len/sum/avg/min/max, range; conditional: if/case/nvl); design registry so additional functions from `fn/` and `mfn/` can be added incrementally without refactoring.
- Integration: expose evaluation helpers that accept row/context maps so dataset filter/aggregate/join/window steps can pass column values; ensure evaluation errors carry step id and column names when invoked from engine.
- Testing: mirror key Java cases and add TS-focused coverage for parser precedence, null semantics, function registry lookups, and dataset/engine integration paths.

## Risks / Trade-offs
- Scope creep from the large Java surface area; mitigation: prioritize and stage functions, leaving stubs/TODOs for low-priority areas.
- Semantic mismatches (null handling, type coercion) could break compatibility; mitigation: codify behaviors in tests derived from Java expectations and document deviations.
- Performance: a naïve interpreter may be slower; acceptable for first cut, with future optimization hooks (precompiled AST reuse, caching functions).

## Migration Plan
- Stage 1: build parser/evaluator + core function subset and wire into dataset/engine APIs; add tests/docs.
- Stage 2 (future): expand function coverage (channels/vdb/cellsets/etc.) as needed, reusing registry.

## Open Questions
- Which specialized functions (e.g., JDBC/canvas/channel) are needed in near term? Default plan is to defer unless requested.
- Confirm acceptable deviations if exact Java behavior is unclear (e.g., string collation, date parsing edge cases).

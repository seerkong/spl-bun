## Context
The Java esProc codebase includes integration layers that tie together expression parsing, dataset operations, adapters, and execution orchestration. The Bun/TypeScript workspace currently exposes these pieces separately (depa-data-core, depa-data-expression, depa-data-sqlite-adapter). We need a composer package that offers a cohesive entry point and mirrors the integration responsibilities for consumers and tests.

## Goals / Non-Goals
- Goals: Provide a facade that wires engine, expression evaluator, and adapters; support constructing/running scripted pipelines from configuration; expose convenient helpers for loading datasets (SQLite) and applying expressions to steps. Keep API minimal and aligned with existing modules.
- Non-Goals: Implement new adapters beyond current SQLite; overhaul engine semantics; add linting; add UI/runtime shells.

## Decisions
- Package placement: new `packages/composer` workspace package exporting an index with a small, documented API (createEngine, runPipeline, helpers for SQLite loading, expression-bound filters/compute steps).
- Compatibility: Preserve naming and structure similar to Java integration points where reasonable, but favor TS simplicity; maintain UTF-8 and Bun tooling.
- Testing: Add integration tests that execute a small pipeline using the composer, leveraging existing test-utils and SQLite fixtures.
- Extensibility: Allow adapter registration so future sources can be plugged in without changing the composer core.
- External effects: Do **not** use implicit dependency injection; all external side-effect management (adapters, IO, configs) must follow the `runtime设计模式` documented in `spl-bun/doc/runtime/` (e.g., explicit runtime objects/contexts).

## Risks / Trade-offs
- Risk of over-scoping the facade; mitigate by keeping API thin and deferring advanced features to follow-up changes.
- Potential mismatch with Java semantics; mitigate by referencing key Java integration flows and documenting any deltas.

## Open Questions
- Which Java integration class should be mirrored most closely (exact file TBD from `com.scudata.app`)?
- Should composer handle config loading (files/env) or just programmatic assembly? Default plan: programmatic, with hooks for config if needed.

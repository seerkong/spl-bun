## Context
- We need a browser-based spreadsheet IDE in `spl-bun` analogous to Java `PgmCellSet/PgmNormalCell` with execution via the existing composer/runtime.
- We will ship a lightweight HTML/CSS grid (Option A) instead of AG Grid to avoid license/version friction; layout must be vertical (rows = steps) with expression/result stacked.
- We must port esProc SPL DSL parsing/execution helpers into a new `depa-data-spl-flow` package so the IDE can author SPL DSL, not just expressions.
- Side effects (runtime wiring, adapters) must follow `doc/runtime` runtime设计模式; implicit DI is disallowed.

## Goals / Non-Goals
- Goals: deliver a `packages/web-ide` frontend package with custom grid UI, vertical step layout, and expression/result split; integrate with new `depa-data-spl-flow` + expression/DataSet runtime (runtime设计模式); document usage and add integration tests.
- Non-Goals: recreating the full AG Grid feature set or adding hidden dependency injection; keep server minimal (existing web-server is enough).

## Decisions
- Use a custom HTML/CSS grid renderer for authoring (editable, A/B/C columns, vertical rows), and stack a separate results table underneath; AG Grid community can be used for displaying multi-row calculation outputs only (not for authoring).
- Create `depa-data-spl-flow` to port Command/ParamParser/KeyWord/CellRef parsing and expose compile/evaluate helpers that wrap existing expression/DataSet runtime.
- Represent sheet state via a cell-set model; execution via explicit runtime contexts (adapters, logging) per runtime设计模式.
- Provide web-ide init that binds runtime contexts explicitly; consumers must supply adapters, logger, and (optionally) DSL/runtime options; no implicit DI.

## Risks / Trade-offs
- Custom grid means more UI work (selection/editing) but avoids AG Grid licensing/version conflicts and works with pure Bun bundling.
- DSL port may diverge if incomplete; mitigate with unit tests mirroring Java fixtures.
- Browser-only package; Node-side tests may need JSDOM or playwright-lite harness.

## Open Questions
- Do we need collaborative editing/multi-sheet support in v1, or is a single-sheet editor sufficient?
- Should we persist sheet layouts locally (localStorage) or leave persistence to host app? (Default: leave to host; document extension points.)

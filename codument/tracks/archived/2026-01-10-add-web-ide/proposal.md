# Change: Add web IDE package for spreadsheet-style SPL editing

## Why
We need a browser-based, Excel-like editor to author and run SPL pipelines, matching the Java esProc spreadsheet experience and integrating with the Bun runtime/composer.

## What Changes
- Provide a `packages/web-ide` workspace package with a lightweight HTML/CSS grid (no AG Grid) that renders SPL steps vertically (rows as steps) and separates expression/result per step.
- Introduce a new `depa-data-spl-flow` package that ports the esProc SPL DSL parsing/execution helpers (Command/ParamParser/KeyWord/cell refs) so cells can author SPL DSL, not just expressions.
- Wire web-ide runtime to the DSL package and existing expression/DataSet engine using the runtime设计模式 (explicit context; no implicit DI), including docs and tests for vertical layout + DSL execution.

## Impact
- Specs: update `web-ide` capability to reflect custom grid, vertical step layout, and DSL support; add DSL capability for `depa-data-spl-flow`.
- Code: `packages/web-ide` UI/runtime, new `packages/spl-flow`, docs under `spl-bun/doc`, and tests covering DSL parsing + vertical sheet execution.

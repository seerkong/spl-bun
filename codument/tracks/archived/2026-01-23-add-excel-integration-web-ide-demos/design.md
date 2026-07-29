## Context

- Web-IDE expressions are executed on the backend by `depa-data-web-server`, which calls `depa-data-spl-flow` (`evaluateFlow`).
- The `depa-data-expression` package is intentionally mostly pure (parsing/evaluation). File IO is provided by the outer runtime via typed handles and runtime builtins.
- Today, `depa-data-spl-flow` implements `T()` as a runtime builtin that reads `.csv` and `.json` only (see `packages/spl-flow/src/index.ts`).
- Java reference sources are available in the parent repository (relative to `spl-bun/`):
  - `../src/main/java/com/scudata/expression` (see `../src/main/java/com/scudata/expression/fn/T.java`)
  - `../src/main/java/com/scudata/excel` (see `../src/main/java/com/scudata/excel/ExcelTool.java`)

This track implements Excel IO in the runtime layer, not in the expression engine.

## Goals / Non-Goals

Goals:
- Provide `.xls/.xlsx` import/export usable from Web-IDE expressions with minimal friction.
- Preserve existing behavior for CSV/JSON.
- Keep path handling safe (no escape from workspace root).

Non-Goals:
- Full Java workbook object parity (`xlsopen/xlscell/xlsmove`).
- Streaming `.xlsx` import/export for huge files.

## Proposed Implementation Direction

### Where to implement
- Extend `tFn` (the runtime builtin behind `T()`) in `packages/spl-flow/src/index.ts`.

Rationale:
- `spl-flow` already owns the workspaceRoot/path policy via `resolveWorkspacePath`.
- The expression engine should remain environment-agnostic.

### Excel parsing/writing
- Add a single dependency capable of reading and writing `.xls/.xlsx` (e.g. `xlsx` / SheetJS).

Read path:
- Load the workbook from the resolved file path.
- Select worksheet by `options.sheet` (default first sheet).
- Convert to a row-wise table:
  - header row -> object keys when `header=true`
  - otherwise generate `#1`, `#2`, ... keys

Write path:
- Accept an array of records or `{ rows: [...] }`.
- Produce a worksheet and write to the resolved output path.

### Options model (no `@opt` syntax)
The TS expression grammar does not support Java-style `fn@opt(...)`. We use an object argument for options.

Examples:
- `T("./data/scores.xlsx", { sheet: 2, header: true })`
- `T("./data/out/export.xlsx", table, { sheet: "Sheet1", header: true })`

This is consistent with other TS APIs that already use plain objects for configuration (e.g. join/group specs).

### Workspace root / Web server stability
- `packages/web-server/src/server.ts` should pass an explicit `workspaceRoot` to `buildFlowScope` and `evaluateFlow`.

Rationale:
- Web-IDE demos rely on relative paths like `./data/sales.csv`.
- Setting `workspaceRoot` removes reliance on the process working directory.

### Demo data strategy
- Store demo `.xls/.xlsx` input files under `packages/web-server/data/`.
- Store exports under `packages/web-server/data/out/`.

### Testing
- Add unit tests under `packages/spl-flow/__tests__`:
  - Import `.xls/.xlsx` from generated fixture workbooks.
  - Export to a temp path and re-import.
  - Reject paths escaping workspace root.

- Optionally add a Web-IDE e2e test to assert the new demo is selectable and executes without errors.

## Risks / Tradeoffs

- Dependency size and runtime overhead.
- Cell type coercion differences (numbers/dates/blank cells).
- Binary fixtures in repo (if we choose to commit demo `.xlsx` files).

## Future Extensions

- Add `file("...").xlsimport(...)` and `file("...").xlsexport(...)` member functions.
- Add workbook-object operations (`xlsopen/xlscell/xlsmove`) if needed.
- Add cursor/streaming mode for large `.xlsx` files.

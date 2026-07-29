# Change: Add Excel integration and Web-IDE demos

## Background

The Web-IDE currently demonstrates file loading via `T("./data/*.csv")` and `T("./data/*.json")`, powered by the `depa-data-spl-flow` runtime.

At the moment, the runtime `T()` implementation only supports CSV/JSON (see `packages/spl-flow/src/index.ts`), so Web-IDE users cannot directly read/write Excel files from expressions.

Meanwhile, SPL in the Java ecosystem has first-class Excel import/export APIs (e.g., `xlsimport`, `xlsexport`, `xlsopen`, and workbook operations like `xlscell`).

In this workspace, the Java reference implementation is available in the parent repository (relative to `spl-bun/`):
- `../src/main/java/com/scudata/expression` (expression engine)
- `../src/main/java/com/scudata/excel` (Excel IO)

Key reference files we will use to define semantics:
- `../src/main/java/com/scudata/expression/fn/T.java` (Excel dispatch in `T()`)
- `../src/main/java/com/scudata/expression/mfn/file/XlsImport.java` (import options and rules)
- `../src/main/java/com/scudata/expression/mfn/file/XlsExport.java` (export options and rules)
- `../src/main/java/com/scudata/expression/mfn/file/XlsOpen.java` (workbook-object opening modes)
- `../src/main/java/com/scudata/expression/FunctionLib.java` (function registrations)

We want to introduce a minimal, pragmatic subset in TypeScript to enable Excel-focused demos and unblock common workflows.

## Goals / Non-Goals

Goals:
- Add `.xls/.xlsx` read capability usable from Web-IDE expressions.
- Add `.xls/.xlsx` write capability usable from Web-IDE expressions.
- Keep the expression grammar unchanged (no Java-style `fn@opt(...)`).
- Provide Web-IDE demos that show Excel import/export end-to-end.
- Keep file path access safe (no workspace escape).

Non-Goals (for this track):
- No full Java parity for `xlsopen/xlscell/xlsmove` workbook-object operations.
- No streaming cursor-mode Excel import for huge `.xlsx` files.
- No `.xlsb` (binary workbook) / `.xlsm` (macro-enabled) support in this track.
- No browser-side Excel parsing; all Excel IO happens on the backend runtime.

## Proposed API Surface (initial)

- Extend `T()` dispatch in `depa-data-spl-flow` to support `.xls` and `.xlsx`.

  Read:
  - `T("./data/scores.xlsx")` (or `T("./data/scores.xls")`) returns a table-like value (`{ rows, schema }`) like CSV/JSON.

  Write:
  - `T("./data/out/export.xlsx", tableOrRows)` (or `T("./data/out/export.xls", tableOrRows)`) writes an Excel file and returns the output path string.


- Optional options object (no `@options` syntax):
  - `T("./data/scores.xlsx", { sheet: 1, header: true })`
  - `T("./data/out/export.xlsx", tableOrRows, { sheet: "Sheet1", header: true })` (also works for `.xls`)

## What Changes

Expected code changes:
- `packages/spl-flow/src/index.ts`
  - Extend `tFn` to handle `.xls/.xlsx` reading/writing.
  - Ensure path resolution uses existing `resolveWorkspacePath`.
- `packages/web-server/src/server.ts`
  - Set `workspaceRoot` explicitly so `T("./data/..." )` is stable regardless of process working directory.
  - Ensure `./data/out` exists when demos export files.
- `packages/web-ide/src/pages/SplIde.vue`
  - Add 1-2 demos for Excel import/export.
- Tests:
  - `packages/spl-flow/__tests__/*` for Excel import/export behavior (.xls/.xlsx).
  - Optionally update Web-IDE e2e tests to include the new demo(s).

Expected dependency changes:
- Add an Excel parser/writer dependency that supports `.xls/.xlsx` (e.g. `xlsx` / SheetJS) to the workspace, scoped to `depa-data-spl-flow` if possible.

## Risks / Mitigations

- Risk: Excel libraries can be large.
  - Mitigation: keep integration minimal (read first sheet, write simple row-wise tables).

- Risk: Type coercion differences (dates/numbers) vs SPL Java behavior.
  - Mitigation: document the initial coercion rules; add tests for typical numeric/date cells.

- Risk: Accidental file overwrite or path traversal.
  - Mitigation: reuse `resolveWorkspacePath` and restrict writes to `./data/out/` by default.

## Open Questions

- Do we need `file("...").xlsimport(...)` and `file("...").xlsexport(...)` in addition to `T()`?
- What subset of options is required in v1 (sheet name, header row, trimming, row ranges)?
- Do we need cursor/streaming mode similar to Java `xlsimport@c` (xlsx-only in Java)?
- Should export refuse overwriting existing files?

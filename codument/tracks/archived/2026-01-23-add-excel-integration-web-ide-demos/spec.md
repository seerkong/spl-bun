## Overview

This track adds a minimal Excel integration surface to the TypeScript runtime so users can import and export Excel files (`.xls` and `.xlsx`) from Web-IDE expressions.

The scope is intentionally small (row-wise tables, first-sheet defaults) to unblock common workflows and demos without implementing the full Java workbook-object API.

---

## ADDED Requirements

### Requirement: Read `.xls/.xlsx` via `T()`
The runtime SHALL extend `T()` to read `.xls` and `.xlsx` files.

- `T(path)` where `path` ends with `.xls` or `.xlsx` SHALL return a table-like value compatible with existing Web-IDE rendering:
  - `rows: Record<string, unknown>[]`
  - `schema?: { name: string }[]`
- By default, `T()` on Excel inputs SHALL read the first worksheet.
- By default, `T()` on Excel inputs SHALL treat the first row as column headers.

Optional read options:
- `T(path, options)` where `options` is an object MAY be supported.
- If supported, `options.sheet` SHALL accept either a 1-based sheet index or a sheet name string.
- If supported, `options.header` SHALL accept a boolean:
  - `true` means first row is headers (default)
  - `false` means columns are named `#1`, `#2`, ...

#### Scenario: Read a simple `.xlsx` as a table
- **GIVEN** a demo Excel file `./data/scores.xlsx` with a header row and data rows
- **WHEN** evaluating `T("./data/scores.xlsx")`
- **THEN** the result contains `rows.length > 0`
- **AND** the result contains a schema with column names from the first row

#### Scenario: Read a simple `.xls` as a table
- **GIVEN** a demo Excel file `./data/scores.xls` with a header row and data rows
- **WHEN** evaluating `T("./data/scores.xls")`
- **THEN** the result contains `rows.length > 0`
- **AND** the result contains a schema with column names from the first row

#### Scenario: Select a sheet by name
- **GIVEN** a demo Excel file `./data/scores.xlsx` containing a sheet named `School2`
- **WHEN** evaluating `T("./data/scores.xlsx", { sheet: "School2" })`
- **THEN** the returned rows come from the `School2` worksheet


### Requirement: Write `.xls/.xlsx` via `T()`
The runtime SHALL extend `T()` to write `.xls` and `.xlsx` files.

- `T(path, data)` where `path` ends with `.xls` or `.xlsx` SHALL write the provided data in a row-wise layout.
- `data` SHALL accept either:
  - an array of records (`Record<string, unknown>[]`), or
  - a table-like value with `rows`.
- `T(path, data)` SHALL return the output path string.

Optional write options:
- If supported, `options.sheet` SHALL accept either a 1-based sheet index or a sheet name string.
- If supported, `options.header` SHALL accept a boolean:
  - `true` writes a header row (default)
  - `false` writes no header row

#### Scenario: Export and re-import (.xlsx)
- **GIVEN** `sales = T("./data/sales.csv")`
- **WHEN** evaluating `T("./data/out/sales.xlsx", sales)`
- **AND** evaluating `T("./data/out/sales.xlsx")`
- **THEN** the re-imported table has `rows.length > 0`

#### Scenario: Export and re-import (.xls)
- **GIVEN** `sales = T("./data/sales.csv")`
- **WHEN** evaluating `T("./data/out/sales.xls", sales)`
- **AND** evaluating `T("./data/out/sales.xls")`
- **THEN** the re-imported table has `rows.length > 0`


### Requirement: Workspace path safety for Excel IO
Excel IO MUST be restricted to the runtime workspace root.

- Relative paths SHALL be resolved against the configured workspace root.
- Paths that escape the workspace root MUST be rejected.

#### Scenario: Reject escaping workspace root
- **GIVEN** a workspace root configured
- **WHEN** evaluating `T("../secrets.xls")`
- **THEN** evaluation fails with an error


### Requirement: Web-IDE demos for Excel import/export
The Web-IDE SHALL include demos that demonstrate Excel import and export.

NOTE: In SPL documentation, examples often show a leading `=` because each SPL cell is written as a formula. In this project’s Web IDE, cells are entered without the leading `=`.

- At least one demo SHALL load an Excel file (`.xls` or `.xlsx`).
- At least one demo SHALL export to `./data/out/*.xls` or `./data/out/*.xlsx` and then read it back.

#### Scenario: Demo loads Excel in Web-IDE
- **GIVEN** the Web-IDE demo list
- **WHEN** selecting the Excel import demo
- **THEN** the first evaluated cell includes `T("./data/scores.xlsx")`


### Requirement: Tests and coverage
The project SHALL add unit tests for the new Excel runtime behavior.

- Tests SHALL validate Excel (`.xls/.xlsx`) read and write paths.
- New code SHOULD meet the project coverage target (>80%).

#### Scenario: Excel tests pass
- **GIVEN** the new Excel IO implementation
- **WHEN** running `bun test`
- **THEN** all tests pass

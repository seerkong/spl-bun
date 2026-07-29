## Overview

This track aligns the TypeScript expression syntax with SPL (Java) call conventions by adding:

1) `@` function variants (e.g. `T@c(...)`, `file(...).xlsimport@t(...)`)
2) `;` argument groups inside call parentheses (e.g. `T(path, data; "Sheet1")`)

It also migrates all Excel `T()` call sites introduced in the TypeScript implementation to the Java-style semicolon syntax, and removes the TS-only object-options form.

IMPORTANT: In SPL examples, cells are often shown with a leading `=`. In this project's Web IDE, expressions do NOT include the leading `=`.

---

## ADDED Requirements

### Requirement: Support `@` variants for function calls
The expression parser SHALL support `fn@opt(...)` syntax.

- `opt` SHALL be parsed as a non-empty sequence of ASCII letters and/or digits.
- `opt` SHALL be normalized to lowercase for evaluation.

#### Scenario: Function call with @ variants parses
- **GIVEN** an expression `T@c("./data/sales.csv")`
- **WHEN** the expression is parsed
- **THEN** it produces a call node for function `T` with option string `"c"`


### Requirement: Support `@` variants for member calls
The expression parser SHALL support `obj.method@opt(...)` syntax.

- `opt` SHALL be parsed as a non-empty sequence of ASCII letters and/or digits.
- `opt` SHALL be normalized to lowercase for evaluation.

#### Scenario: Member call with @ variants parses
- **GIVEN** an expression `f.xlsimport@t(;"School1")`
- **WHEN** the expression is parsed
- **THEN** it produces a member-call node for method `xlsimport` with option string `"t"`


### Requirement: Support semicolon-separated argument groups in call syntax
The expression parser SHALL support `;` inside function and member call parentheses as a grouping separator.

- `;` MUST split argument groups.
- Within each group, arguments MUST still be comma-separated.
- Quotes and nested parentheses/brackets/braces MUST prevent splitting.

#### Scenario: Semicolon groups are preserved
- **GIVEN** an expression `T("./out.xlsx", data; "School1")`
- **WHEN** the expression is parsed
- **THEN** it produces argument groups equivalent to:
  - group 1: `"./out.xlsx"`, `data`
  - group 2: `"School1"`


### Requirement: Excel `T()` uses Java-style `;` sheet argument
The runtime SHALL accept Java-style Excel `T()` syntax for `.xls/.xlsx`:

- Export/write:
  - `T(path, data; sheet)`
- Import/read:
  - `T(path; sheet)`

Notes:
- `sheet` MAY be omitted to mean the first sheet.
- `sheet` MAY be a string (sheet name) or a number (1-based sheet index).

#### Scenario: Export to a named sheet
- **GIVEN** `data = [{ Name:"Alice", Score:98 }]`
- **WHEN** evaluating `T("./data/out/scores.xlsx", data; "School1")`
- **THEN** the file is written and the expression returns the output path string

#### Scenario: Import from a named sheet
- **GIVEN** an Excel file at `./data/out/scores.xlsx` containing a sheet named `School1`
- **WHEN** evaluating `T("./data/out/scores.xlsx"; "School1")`
- **THEN** the returned table contains rows from `School1`


### Requirement: Excel `T()` supports `@` options parity subset
The runtime SHALL support the following Java-style options for Excel `T()` (subset):

- `@b`: no header/title row (default is has header)
- `@c`: read as cursor (xlsx-only) MAY be added later; if not implemented in v1, it MUST fail with a clear error

#### Scenario: No-header import
- **GIVEN** an Excel file where the first row is data (not headers)
- **WHEN** evaluating `T@b("./data/in/no_header.xlsx")`
- **THEN** the returned table uses generated column names (`#1`, `#2`, ...)


## MODIFIED Requirements

### Requirement: Registry dispatch uses base name + option string
The evaluator SHALL dispatch `fn@opt(...)` and `obj.method@opt(...)` to the base function/method implementation.

- Option strings MUST be passed to the implementation in a consistent way.
- The track design MUST define the exact calling convention.

#### Scenario: Options are delivered to implementation
- **GIVEN** a test-only function that echoes received options
- **WHEN** evaluating `echo@ab(1,2)`
- **THEN** the callee observes option string `"ab"`


## REMOVED Requirements

### Requirement: Remove TS-only Excel `T()` options-object signature
The TS-only Excel form MUST be removed:

- `T(path, data, { sheet: ..., header: ... })`
- `T(path, { sheet: ..., header: ... })`

#### Scenario: Old options-object form fails
- **GIVEN** an expression `T("./out.xlsx", data, { sheet: "S1" })`
- **WHEN** evaluated
- **THEN** evaluation fails with an error indicating the syntax is no longer supported


### Requirement: Migrate all Excel `T()` call sites to Java-style syntax
All `.xls/.xlsx` `T()` call sites in this repository SHALL be migrated to the Java-style syntax using `;` and `@`.

#### Scenario: No remaining object-options Excel T() calls
- **GIVEN** the codebase
- **WHEN** searching for Excel `T()` calls using an options object
- **THEN** there are zero remaining matches

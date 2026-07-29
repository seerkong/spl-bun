## Overview

This track updates the spl-flow expression prefix semantics so a leading `>` denotes execute-only expressions that do not assign to the cell scope, while still recording results and updating `lastQuery` when applicable. It also adds a Web-IDE demo and test coverage for the new behavior.

---

## MODIFIED Requirements

### Requirement: Grid-based flow evaluation
The `spl-flow` runtime SHALL evaluate a 2D grid of cells addressed by (row, col) and by `cellRef` (e.g. `A1`).

- Each evaluated cell SHALL write its value into `scope[cellRef]`, except execute-only expressions.
- Evaluation order SHALL follow SPL grid navigation rules (row/col positioning + `setNext`-style navigation), skipping blank/comment cells.
- The runtime SHALL support nested code blocks using indentation (cells to the right of a command cell).

- Expression cells MAY optionally start with a leading `=` or `>` prefix (Java SPL style); the runtime SHALL strip this prefix before evaluating the expression.
- A leading `=` denotes a calculation cell whose evaluation result MUST be assigned to `scope[cellRef]`.
- A leading `>` denotes an execute-only cell whose evaluation result MUST be recorded in the evaluation report but MUST NOT be assigned to `scope[cellRef]`.
- Execute-only expressions MAY update the flow `lastQuery` when their evaluation returns a query result.
- Prefix handling applies only to expression cells; command keywords are detected before prefix stripping, and command cells MUST NOT use a leading `>`.

- A blank cell is a cell whose content is empty/whitespace.
- A comment cell is a cell whose trimmed content begins with `//`.
- A comment cell acts like a line comment: any cells to the right of the comment cell on the same row MUST be ignored (not evaluated and not part of the program).
- After applying the comment-cell row truncation rule, the runtime MUST reject programs that contain more than one non-blank, non-comment cell with the same row number (one executable statement per row).

#### Scenario: Basic sequential evaluation remains supported
- **GIVEN** cells:
  - `A1: a = 2`
  - `A2: b = 3`
  - `A3: a + b`
- **WHEN** evaluating the flow
- **THEN** `scope.A3` is `5`

#### Scenario: Optional leading '=' and '>' prefixes are accepted
- **GIVEN** cells:
  - `A1: =1 + 2`
  - `A2: 1 + 2`
  - `A3: >1 + 2`
- **WHEN** evaluating the flow
- **THEN** `scope.A1` is `3`
- **AND** `scope.A2` is `3`
- **AND** `scope.A3` remains unset
- **AND** the evaluation report for `A3` records result `3`

#### Scenario: Execute-only expressions update lastQuery
- **GIVEN** cells:
  - `A1: >demo.query("select 1 as v")`
  - `A2: 1 + 1`
- **WHEN** evaluating the flow with a `demo` connection
- **THEN** `lastQuery` is the query result from `A1`
- **AND** `scope.A1` remains unset

#### Scenario: Comment cells are skipped
- **GIVEN** cells:
  - `A1: // comment`
  - `A2: 1 + 1`
- **WHEN** evaluating the flow
- **THEN** `scope.A1` remains unset
- **AND** `scope.A2` is `2`

#### Scenario: Single '/' is not a comment
- **GIVEN** cells:
  - `A1: 6 / 2`
- **WHEN** evaluating the flow
- **THEN** `scope.A1` is `3`

#### Scenario: Comment cells truncate the rest of the row
- **GIVEN** cells:
  - `A1: x = 1`
  - `B1: // inline comment`
  - `C1: x = 2`
  - `A2: x`
- **WHEN** evaluating the flow
- **THEN** `scope.A2` is `1`
- **AND** `scope.C1` remains unset

#### Scenario: Multiple executable cells in the same row are rejected
- **GIVEN** cells:
  - `A1: 1`
  - `B1: 2`
- **WHEN** evaluating the flow
- **THEN** evaluation fails with a clear error about multiple executable cells in row `1`

## ADDED Requirements

### Requirement: Web-IDE demo includes execute-only expression
The Web-IDE demo list SHALL include a demo named `Flow Control: Execute-only (>)` that demonstrates execute-only behavior.

#### Scenario: Execute-only demo shows unassigned cell
- **GIVEN** the demo list contains `Flow Control: Execute-only (>)`
- **WHEN** the demo is loaded and executed
- **THEN** the demo completes successfully
- **AND** the demo output demonstrates that an execute-only cell does not assign its value (e.g., via an `isnull(A2)` or equivalent check)

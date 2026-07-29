## Overview

This track adds Web-IDE demos so the flow-control features from `impl-flow-control` can be experienced and run directly in the UI.

The flow-control runtime already exists in `packages/spl-flow`. What is missing is:
- Web-IDE demo sheets that exercise each statement.
- Web-IDE "Run Sheet" collecting multi-column cells so indentation blocks (B/C/D...) can be represented.
- E2E coverage to prevent demo regressions.

Key constraints inherited from the TypeScript dialect:
- Only `//` starts a comment cell; a comment cell truncates the row to the right.
- After truncation, at most one executable (expression/command) cell per row.
- `continue` is supported; `next` is rejected.

---

## ADDED Requirements

### Requirement: Web-IDE can execute multi-column flow grids

The Web-IDE SHALL collect non-empty cell contents from a bounded grid region (multiple columns, not just column A) and send them to the backend as `flowDef: {row, col, expr}[]`.

#### Scenario: A demo uses indentation blocks in column B/C
- **GIVEN** a demo that includes a command cell at `A1` (e.g. `for 3`) and block cells at `B2`, `B3`, ...
- **WHEN** the user loads the demo and clicks "Run Sheet"
- **THEN** the backend receives both the `A*` and `B*` cells
- **AND** the flow executes correctly, producing a visible output table in AG Grid


### Requirement: Add flow-control demos for all new statements

Web-IDE SHALL provide separate demos (one per statement or one per scenario family) to cover:
- `if / elseif / else`
- `for` variants: infinite, count, range (with optional step), sequence, while-condition
- `break / continue` (including target cellRef)
- `goto`
- `func / return`
- `try`
- `result / end`

Each demo MUST respect the TS dialect (one executable cell per row).

#### Scenario: If/ElseIf/Else demo
- **GIVEN** a demo named like "Flow Control: If/ElseIf/Else"
- **WHEN** the user runs it
- **THEN** the output table indicates which branch was taken

#### Scenario: For variants demos
- **GIVEN** separate demos for count/range/sequence/while/infinite
- **WHEN** the user runs each demo
- **THEN** the output table shows the expected aggregated result (e.g. sums / iteration counts)

#### Scenario: break/continue targeting demo
- **GIVEN** a nested loop demo that uses `break <cellRef>` and `continue <cellRef>`
- **WHEN** the user runs it
- **THEN** the output table matches the expected hit count / termination behavior

#### Scenario: goto demo
- **GIVEN** a demo that uses `goto <cellRef>`
- **WHEN** the user runs it
- **THEN** the output table reflects the jump (skipped cells do not affect output)

#### Scenario: func/return demo
- **GIVEN** a demo that defines a subroutine with `func` and calls it via `func(A1, ...)`
- **WHEN** the user runs it
- **THEN** the output table shows the returned value

#### Scenario: try demo
- **GIVEN** a demo that executes a failing expression inside a `try` block
- **WHEN** the user runs it
- **THEN** the output table includes the captured error string and continues execution

#### Scenario: result/end demo
- **GIVEN** a demo that prepares a summary table, then executes `result <expr>`
- **WHEN** the user runs it
- **THEN** the flow terminates early and the output table corresponds to the pre-result value
- **AND** a separate demo for `end "message"` shows an error status in the UI


### Requirement: Demo output is visible via AG Grid

Each flow-control demo SHOULD end by producing a QueryResult-like object:

```js
{ columns: ["name", "value"], rows: [ { name: "...", value: 123 } ] }
```

so that the Web-IDE result grid (AG Grid) always shows something meaningful after running.


### Requirement: Playwright E2E covers the new demos

Playwright E2E tests SHALL include smoke coverage for the new demos:
- Load each new demo
- Run Sheet
- Assert status contains "Done"
- Assert the output grid contains an expected row label

---

## Acceptance Criteria

- Web-IDE can execute demos that rely on multi-column indentation blocks.
- Demo list includes flow-control demos covering all new statements.
- Each demo produces a visible summary table output.
- `bun test` does not execute Playwright tests; `bun run test:e2e` covers the demos and passes.

## Out of Scope

- Changing `packages/spl-flow` semantics or adding new flow-control statements.
- Building a full tutorial UI; this track focuses on runnable demos + minimal UI plumbing.

# SPL Bun Web IDE (grid) tech selection — built-in ResultTable

## Context
- Goal: build a web-IDE package in `spl-bun` for spreadsheet-like SPL authoring/execution (Excel-style grid with step-by-step results), running fully in the browser.
- Alignment with runtime design mode: external side-effects (adapter wiring, backend calls) stay explicit/config-driven with no implicit DI.

## Current choice
- Authoring area: Univer Sheets core preset, used as plain-text SPL grid input.
- Result area: built-in Vue `ResultTable` component (`packages/web-ide/src/components/ResultTable.vue`).
- No third-party grid dependency in `depa-data-web-ide`.

## Why built-in ResultTable
- Lightweight dependency surface and simpler maintenance.
- Tight control over interaction details (row selection, cell-range selection, clipboard copy).
- Easy to align with SPL evaluation output format (`columns` + `rows`) without adapter glue.

## Integration notes for `packages/web-ide`
- Keep result rendering based on `ResultTable` props:
  - `columns: string[]`
  - `rows: Record<string, unknown>[]`
- Preserve clear separation:
  - Spreadsheet input/editing in Univer area.
  - Result visualization in ResultTable area.
- Avoid introducing external-grid-specific setup, selectors, or styles.

## Risks / follow-up
- Large result sets may require pagination or virtualization later.
- If performance pressure grows, optimize ResultTable incrementally before considering a new grid dependency.

# References (Copied Excerpts)

This track is self-contained. The excerpts below capture the Excel import/export idioms we want to enable in the TypeScript runtime.

IMPORTANT: SPL examples are typically written with an `=` prefix at the start of a cell (e.g. `=T("Orders.xlsx")`). In THIS Web IDE, cells do NOT include the leading `=`; use `T("Orders.xlsx")` directly.

## SPL idioms: Excel import/export

Source: SPLWare/esProc GitHub Wiki ("SPL: Reading and Writing Excel Files")

Read (row-wise table, first row as header):
```spl
=file("e:/scores.xlsx").xlsimport@t()
```

Read a named sheet:
```spl
=file("e:/scores.xlsx").xlsimport@t(;"School2")
```

Read as cursor for huge xlsx:
```spl
=file("e:/scores.xlsx").xlsimport@tc()
```

Write a table with headers:
```spl
=file("e:/scores.xlsx").xlsexport@t(A1)
```

Append mode:
```spl
=file("e:/scores.xlsx").xlsexport@a(A1)
```


## SPL idioms: T() dispatch

Source: SPLWare/esProc GitHub Wiki ("How to Quickly Split an Excel into Multiple Excels")

Read as cursor:
```spl
=T@c("Orders.xlsx")
```

Write batches to multiple files:
```spl
for A1,300
  =T("Orders"/#A2/".xlsx",A2)
```

Group split into multiple sheets:
```spl
=file("Ordersm.xlsx").xlsexport@kt(A2;A2.Shippers)
```


## Java reference semantics (local source code)

These Java sources exist in the parent repo (relative to `spl-bun/`). We use them to define TS behavior:

- `../src/main/java/com/scudata/expression/fn/T.java`
  - Dispatches `.xls/.xlsx` and composes to `file(...).xlsimport@...` / `file(...).xlsexport@...`.
  - Options:
    - `@b`: no title row (default is has title)
    - `@c`: read as cursor

- `../src/main/java/com/scudata/expression/mfn/file/XlsImport.java`
  - Options include:
    - `@t` header row
    - `@c` cursor (xlsx-only; end row cannot be negative)
    - `@w/@p` double-level sequence (+ transpose)
    - `@s` tab string
    - `@n` trim values / empty -> null

- `../src/main/java/com/scudata/expression/mfn/file/XlsExport.java`
  - Options include:
    - `@t` export title row
    - `@a` append
    - `@c` streaming export
    - `@w/@p` double-level sequence (+ transpose)
    - `@m` multi-sheet when exceeding row limits

- `../src/main/java/com/scudata/expression/FunctionLib.java`
  - Registers member functions: `xlsimport/xlsexport/xlsopen/xlswrite/xlscell/xlsmove`.

For this track we keep scope minimal and do not implement Java-style `@opt` syntax in TS expressions.

## Notes for TS integration

- TS expression grammar does not support `@t/@c/...` syntax.
- For this track, we express options as an object argument (e.g. `{ header: true, sheet: 1 }`).

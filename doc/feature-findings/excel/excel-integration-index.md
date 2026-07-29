# Excel Integration (Index)

Goal: map Java Excel capabilities to TS missing work, focusing on key files for future implementation.

## Java surface area (expression-facing)

### Entry points (member functions)

- `f.xlsopen(p)` -> Excel workbook object
  - Implementation: `src/main/java/com/scudata/expression/mfn/file/XlsOpen.java`
  - Backend objects: `src/main/java/com/scudata/excel/XlsFileObject.java`, `src/main/java/com/scudata/excel/FileXls.java`, `src/main/java/com/scudata/excel/FileXlsR.java`
- `f.xlsimport(...)` -> read Excel into Table/Sequence/Cursor/String depending on options
  - Implementation: `src/main/java/com/scudata/expression/mfn/file/XlsImport.java`
  - Backend: `src/main/java/com/scudata/excel/ExcelTool.java`, streaming path `src/main/java/com/scudata/excel/XlsxSImporter.java`
- `f.xlsexport(...)` -> export Sequence/Cursor to Excel
  - Implementation: `src/main/java/com/scudata/expression/mfn/file/XlsExport.java`
  - Backend: `src/main/java/com/scudata/excel/ExcelTool.java`

### Workbook-object operations (xo.*)

- `xo.xlscell(...)` read/write cells; also rename sheet; supports images
  - Implementation: `src/main/java/com/scudata/expression/mfn/xo/XlsCell.java`
  - Backend: `src/main/java/com/scudata/excel/XlsFileObject.java` (method `xlscell`)
- `xo.xlsmove(...)` move/copy/rename/delete sheets
  - Implementation: `src/main/java/com/scudata/expression/mfn/xo/XlsMove.java`
  - Backend: `src/main/java/com/scudata/excel/XlsFileObject.java` (method `xlsmove`)

### Indirect: builtin `T(...)` dispatches Excel I/O

- `T(...)` composes to `file(...).xlsimport/xlsexport(...)` based on extension
  - Implementation: `src/main/java/com/scudata/expression/fn/T.java`

## Java backend (excel package)

- High-level facade: `src/main/java/com/scudata/excel/ExcelTool.java`
- Workbook object model: `src/main/java/com/scudata/excel/XlsFileObject.java`
- Read/write workbook implementations:
  - `src/main/java/com/scudata/excel/XlsImporter.java`
  - `src/main/java/com/scudata/excel/XlsxImporter.java`
  - `src/main/java/com/scudata/excel/XlsExporter.java`
  - `src/main/java/com/scudata/excel/XlsxExporter.java`
  - streaming `src/main/java/com/scudata/excel/XlsxSImporter.java`, `src/main/java/com/scudata/excel/XlsxSSheetParser.java`
- Sheet object: `src/main/java/com/scudata/excel/SheetXls.java` (read/write cells, styles, images)

## TypeScript status

- No Excel integration found in `spl-bun/packages/expression/src`.
- No `xls*` builtins or member functions.

Candidate TS integration points (where to add capability)
- Function registry (builtins): `spl-bun/packages/expression/src/functions.ts`
- Member functions: `spl-bun/packages/expression/src/memberRegistry.ts`
- Typed handles: `spl-bun/packages/expression/src/types.ts`

Checklist (missing)
- [ ] Define workbook object type tag (analogous to Java `XlsFileObject`).
- [ ] Implement `xlsopen/xlsimport/xlsexport` surface in TS.
- [ ] Implement `xlscell/xlsmove` operations on the workbook object.
- [ ] Decide whether to support `T(...)`-style dispatch at expression layer or higher runtime layer.

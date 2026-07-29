# References (Local and Copied)

This track is self-contained.

## External SPL references

- SPLWare wiki: `@` options syntax and composition (e.g. `T.select@zc(...)`)
  - https://github.com/SPLWare/esProc.wiki/blob/fcdfe4dcd0837ca431334668964dd73c09fb9a90/Understand%20SPL%20in%20three%20aspects.md#L31-L41

- SPLWare wiki: semicolon/comma/colon layered parameters and semicolon groups
  - https://github.com/SPLWare/esProc.wiki/blob/fcdfe4dcd0837ca431334668964dd73c09fb9a90/Understand%20SPL%20in%20three%20aspects.md#L45-L49

- SPLWare wiki: option string model (`f@tcq()` -> option="tcq")
  - https://github.com/SPLWare/esProc.wiki/blob/fcdfe4dcd0837ca431334668964dd73c09fb9a90/SPL%EF%BC%9AUser-defined%20Functions.md#L37-L42

- SPLWare wiki: semicolon group parsed as parameter-tree root (IParam.Semicolon)
  - https://github.com/SPLWare/esProc.wiki/blob/fcdfe4dcd0837ca431334668964dd73c09fb9a90/SPL%EF%BC%9AUser-defined%20Functions.md#L47-L52

## Java SPL semantics (local sources)

- `../src/main/java/com/scudata/expression/fn/T.java`
  - Comment summary:
    - Read files by extension: txt/csv/xls/xlsx/btx/ctx
    - For Excel: `s` is sheet name
    - When `A` is present, it writes (export)
    - Options:
  - `@b` no title row (default has title)
  - `@c` read as cursor

### Additional Java implementation references (remote)

- esProc (Java) `T()` Excel branch and option docs (`@b`/`@c`, semicolon groups)
  - https://github.com/seerkong/esProc/blob/ac3645e8f64e862d3830c6c42db20e21b9101c8c/src/main/java/com/scudata/expression/fn/T.java

- esProc (Java) `xlsimport` / `xlsexport` param docs (sheet in `; s`)
  - https://github.com/seerkong/esProc/blob/ac3645e8f64e862d3830c6c42db20e21b9101c8c/src/main/java/com/scudata/expression/mfn/file/XlsImport.java
  - https://github.com/seerkong/esProc/blob/ac3645e8f64e862d3830c6c42db20e21b9101c8c/src/main/java/com/scudata/expression/mfn/file/XlsExport.java

## Syntax reminder

- SPL examples often show a leading `=` at the start of each cell.
- In THIS project's Web IDE, cells do NOT include the leading `=`. Use `T(...)` directly.

## Target examples for TS after this track

- Import sheet by name:
  - `T("./data/scores.xlsx"; "School1")`

- Export sheet by name:
  - `T("./data/out/scores.xlsx", data; "School1")`

- Disable header row:
  - `T@b("./data/scores.xlsx"; "School1")`

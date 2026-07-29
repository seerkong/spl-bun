# Expression Engine Feature Comparison: Java vs TypeScript (act_6)

> Focus: **Excel integration**, **Chart rendering**, and **Phase 2: Enhanced Functionality (Medium Priority)** items referenced from `doc/brainstorm/port-expression-engine/act_4/engine-feature-diff.md`.
>
> Code scopes compared:
> - TypeScript: `spl-bun/packages/expression`
> - Java: `src/main/java/com/scudata/expression`
> - Java Excel: `src/main/java/com/scudata/excel`
> - Java Chart: `src/main/java/com/scudata/chart` and the canvas facade `src/main/java/com/scudata/dm/Canvas.java`

## 0. Quick Status Summary (Act_6)

### TypeScript (packages/expression)
- Has a working **expression parser + evaluator + builtin registry + member function registry**.
- **No Excel integration** found in `spl-bun/packages/expression/src`.
- **No chart/canvas integration** found in `spl-bun/packages/expression/src`.
- For Phase 2 items, only **partial** support exists (notably set ops); most Phase 2 items are missing.

### Java (com.scudata.expression + com.scudata.excel + com.scudata.chart)
- Has a full expression engine with a **large builtin function library** and **large member function surface** (see `src/main/java/com/scudata/expression/FunctionLib.java`).
- Has first-class **Excel file object** support (`xlsopen/xlsimport/xlsexport/xlscell/xlsmove/...`).
- Has first-class **chart rendering** via `canvas()` + `G.plot(...)` + `G.draw(...)` producing PNG/JPG/GIF/SVG.

## 1. Current TypeScript Expression Engine Inventory (Confirmed)

### 1.1 Core architecture
- AST types: `spl-bun/packages/expression/src/ast.ts`
- Parser: `spl-bun/packages/expression/src/parser.ts`
- Evaluator/compiler: `spl-bun/packages/expression/src/evaluator.ts`
- Builtin function registry: `spl-bun/packages/expression/src/functions.ts`
- Member function dispatch: `spl-bun/packages/expression/src/memberRegistry.ts`
- Typed handles and type tags: `spl-bun/packages/expression/src/types.ts`
- Function registry builder (extensibility): `spl-bun/packages/expression/src/registry.ts`
- Macros (`${expr}`, `$(key)`): `spl-bun/packages/expression/src/macro.ts`
- Param-tree parsing and `ifp/casep`: `spl-bun/packages/expression/src/paramParser.ts`, `spl-bun/packages/expression/src/paramFunctions.ts`

### 1.2 Builtins relevant to Phase 2
- Present builtins include: basic string funcs (upper/lower/trim/replace/pos/split/left/right/mid/concat/len), math (abs/pow/sqrt/sin/cos/tan/log/log10/ceil/floor/round/rand), datetime (now/date/dateadd/month/day/year/hour/minute/second/datevalue/datetime/datediff/format), aggregation-ish (sum/avg/min/max/median/top/range/count/icount), conversions (json/json_parse/json_stringify/parse), connect: `spl-bun/packages/expression/src/functions.ts`.
- Not present (examples): `like`, regex functions, `workday`, `age`, `exp`, `ln`, `sign`, `gcd`, `lcm` are not found in TS builtin list (confirmed by grep in `spl-bun/packages/expression/src`).

### 1.3 Operators relevant to Phase 2
- Set operators exist at operator-level:
  - `&` -> union, `^` -> intersect, `\` -> diff, `|` -> conj in `spl-bun/packages/expression/src/parser.ts` and `spl-bun/packages/expression/src/evaluator.ts`.

### 1.4 Member functions (TS)
- Sequence/Table-ish member functions implemented: `select`, `sort`, `group`, `join`, `derive` in `spl-bun/packages/expression/src/memberRegistry.ts`.
- Record/Table member functions implemented: `field`, `fname`, `fno`, `key`, `record`, `keys`, `row` in `spl-bun/packages/expression/src/memberRegistry.ts`.
- DB/File/Cursor handles and member dispatch exist, but actual IO/DB execution is provided by outer runtime that supplies handle implementations:
  - handle types in `spl-bun/packages/expression/src/types.ts`
  - dispatch in `spl-bun/packages/expression/src/memberRegistry.ts`

## 2. Java Inventory: Expression + Excel + Chart (Confirmed)

### 2.1 Java expression engine core
- Parser/operator tree construction and macro replacement: `src/main/java/com/scudata/expression/Expression.java`.
- System function registration (builtins + member functions + many categories): `src/main/java/com/scudata/expression/FunctionLib.java`.

### 2.2 Java Excel integration (what exists)

#### A) File-level Excel functions exposed as member functions
- `f.xlsopen(p)` returns an Excel object (XlsFileObject) with read/write modes (`@r` stream read, `@w` stream write): `src/main/java/com/scudata/expression/mfn/file/XlsOpen.java`.
- `f.xlsimport(...)` reads Excel to table/sequence/cursor/string depending on options (`@c/@t/@w/@s/@n/...`): `src/main/java/com/scudata/expression/mfn/file/XlsImport.java`.
- `f.xlsexport(...)` exports sequence/cursor to Excel, with options for append/title/stream/multi-sheet etc: `src/main/java/com/scudata/expression/mfn/file/XlsExport.java`.

#### B) XO-level operations on Excel workbook objects
These apply to the object returned by `xlsopen`.
- `xo.xlscell(...)` read/write cell ranges; can also rename sheet; supports row-insert, returning matrices, trim, images (`@g`): `src/main/java/com/scudata/expression/mfn/xo/XlsCell.java`.
- `xo.xlsmove(...)` move/copy/rename/delete sheets across workbooks: `src/main/java/com/scudata/expression/mfn/xo/XlsMove.java`.
- The registration surface is visible in `src/main/java/com/scudata/expression/FunctionLib.java` (search `xlsexport/xlsimport/xlsopen/xlswrite/xlscell/xlsmove`).

#### C) Excel backend implementation (Apache POI-based)
- Central entry that wraps importer/exporter implementations: `src/main/java/com/scudata/excel/ExcelTool.java`.
- Workbook and sheet object model: `src/main/java/com/scudata/excel/XlsFileObject.java`, `src/main/java/com/scudata/excel/FileXls.java`, `src/main/java/com/scudata/excel/SheetXls.java`.
- Streaming xlsx importer paths: `src/main/java/com/scudata/excel/FileXlsR.java`, `src/main/java/com/scudata/excel/SheetXlsR.java`, `src/main/java/com/scudata/excel/XlsxSSheetParser.java`.

#### D) Builtin T() includes Excel path
- `T(...)` dispatches by extension including `.xls/.xlsx` and composes to `file(...).xlsimport/xlsexport(...)`: `src/main/java/com/scudata/expression/fn/T.java`.

### 2.3 Java chart rendering integration (what exists)

#### A) Expression-level API
- `canvas()` builtin creates a `com.scudata.dm.Canvas`: `src/main/java/com/scudata/expression/fn/CreateCanvas.java`.
- Canvas member fns registered in `src/main/java/com/scudata/expression/FunctionLib.java`:
  - `plot` -> `src/main/java/com/scudata/expression/mfn/canvas/Plot.java`
  - `draw` -> `src/main/java/com/scudata/expression/mfn/canvas/Draw.java`
  - `hlink` -> `src/main/java/com/scudata/expression/mfn/canvas/HLink.java`
- Canvas type binding is handled by `src/main/java/com/scudata/expression/CanvasFunction.java` (ensures left value is `com.scudata.dm.Canvas`).

#### B) Canvas facade (bridges expression and chart engine)
- Canvas stores chart elements, and renders via chart Engine; also stores generated HTML link map:
  - `src/main/java/com/scudata/dm/Canvas.java`
  - uses `new com.scudata.chart.Engine(this.getChartElements())` and `Engine.calcImageBytes(...)`.

#### C) Chart renderer core
- Main rendering engine and export pipeline: `src/main/java/com/scudata/chart/Engine.java`.
  - Can generate bitmap outputs and SVG output; SVG path uses Batik via reflection (`org.apache.batik.*`) inside `Engine.generateSVG`.
  - Supports hyperlinks mapped to shapes (html map and SVG links) via `Engine.getHtmlLinks()` and internal link generation.

## 3. Focus Comparison: Excel Integration (Java vs TS)

### Java has (confirmed)
- End-to-end Excel ingestion/export APIs (`xlsopen/xlsimport/xlsexport`) and workbook-object operations (`xlscell/xlsmove/...`).
- Rich option model: cursor output, title handling, trim, transpose, streaming read/write, images in cells, sheet rename/copy/move.

### TypeScript has (confirmed gaps)
- No corresponding `xls*` builtins or member functions in `spl-bun/packages/expression/src`.
- No workbook object type tags (TS types only define DB/File/Cursor/Sequence/Table-ish): `spl-bun/packages/expression/src/types.ts`.

## 4. Focus Comparison: Chart Rendering (Java vs TS)

### Java has (confirmed)
- Expression-facing API: `canvas()` + `G.plot(...)` + `G.draw(...)` + `G.hlink()`.
- Output formats: SVG by default, plus `@j/@p/@g` in `Draw` for JPG/PNG/GIF: `src/main/java/com/scudata/expression/mfn/canvas/Draw.java`.
- Concrete renderer implementation in `src/main/java/com/scudata/chart/Engine.java`.

### TypeScript has (confirmed gaps)
- No `canvas()` builtin, and no `.plot/.draw` member functions in `spl-bun/packages/expression/src`.
- No TS-side chart engine package under `spl-bun/packages/expression`.

## 5. Phase 2 (Enhanced Functionality / Medium Priority) Gap Map

This section maps the Phase 2 bullets from act_4 to confirmed TS/Java status.

### 5.1 String operations: like, regex, split
- Java:
  - `like` builtin registered: `src/main/java/com/scudata/expression/FunctionLib.java` (see `addFunction("like", ...)`).
  - `regex` exists as member function (multiple targets): `src/main/java/com/scudata/expression/FunctionLib.java` (see `addMemberFunction("regex", ...)`).
  - `split` exists (as member function): `src/main/java/com/scudata/expression/FunctionLib.java`.
- TypeScript:
  - `split` exists as builtin: `spl-bun/packages/expression/src/functions.ts`.
  - `like` missing in TS builtins: `spl-bun/packages/expression/src/functions.ts`.
  - `regex` missing in TS member registry: `spl-bun/packages/expression/src/memberRegistry.ts`.

### 5.2 Math functions: exp, ln, sign, gcd, lcm
- Java: registered in `src/main/java/com/scudata/expression/FunctionLib.java` (`exp/ln/sign/gcd/lcm`).
- TypeScript: not present in `spl-bun/packages/expression/src/functions.ts`.

### 5.3 Date operations: age, workday
- Java: registered in `src/main/java/com/scudata/expression/FunctionLib.java` (`age/workday/workdays`).
- TypeScript: not present in `spl-bun/packages/expression/src/functions.ts`.

### 5.4 Set operations: union, diff, isect
- Java:
  - Builtin aggregation set ops exist (`union` etc) and member functions include `union/diff/isect`: `src/main/java/com/scudata/expression/FunctionLib.java`.
  - Also operator variants exist (`&`, `^`, `\`, `|` etc) in `src/main/java/com/scudata/expression/Expression.java`.
- TypeScript:
  - Operator-level set ops exist (`&`, `^`, `\\`, `|`): `spl-bun/packages/expression/src/parser.ts`, `spl-bun/packages/expression/src/evaluator.ts`.
  - NOTE: act_4 Phase 2 explicitly calls out set ops; TS already has them at operator level, but does not expose `isect` named function/member method.

### 5.5 Table operations: rename, alter, index
- Java: member functions are registered in `src/main/java/com/scudata/expression/FunctionLib.java` (`rename/alter/index`).
- TypeScript: no `rename/alter/index` member functions exist in `spl-bun/packages/expression/src/memberRegistry.ts`.

## 6. Implications / Implementation Direction (Non-prescriptive)

(Non-goal: designing the implementation here; this section only highlights what missing surface implies for follow-up work.)

- To reach Java parity for Excel integration, TS will need:
  - a workbook object model analogous to `com.scudata.excel.XlsFileObject` (or a narrower subset)
  - expression member functions mirroring `xlsopen/xlsimport/xlsexport/xlscell/xlsmove` semantics.
- To reach Java parity for chart rendering, TS will need:
  - a `canvas()` builtin + a canvas object type and `.plot/.draw/.hlink` members
  - an actual rendering backend (SVG at minimum, optionally bitmap).
- For Phase 2, TS currently has only partial coverage (split + set ops); the rest are missing.


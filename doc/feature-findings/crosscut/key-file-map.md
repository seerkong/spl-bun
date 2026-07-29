# Key File Map (Cross-cut)

This is a grep-friendly map of where to look for specific feature families.

## TypeScript (spl-bun/packages/expression)

Core engine
- `spl-bun/packages/expression/src/parser.ts` (tokenizer + precedence + AST build)
- `spl-bun/packages/expression/src/ast.ts` (AST node + operator types)
- `spl-bun/packages/expression/src/evaluator.ts` (evaluation semantics)

Function surfaces
- Builtins: `spl-bun/packages/expression/src/functions.ts`
- Member functions: `spl-bun/packages/expression/src/memberRegistry.ts`
- Registry builder: `spl-bun/packages/expression/src/registry.ts`

Aux
- Param tree (`ifp/casep`): `spl-bun/packages/expression/src/paramParser.ts`, `spl-bun/packages/expression/src/paramFunctions.ts`
- Macro expansion: `spl-bun/packages/expression/src/macro.ts`
- Typed handles: `spl-bun/packages/expression/src/types.ts`

## Java (src/main/java/com/scudata/expression)

Core engine
- `src/main/java/com/scudata/expression/Expression.java` (parse + operators + macro replacement)
- `src/main/java/com/scudata/expression/FunctionLib.java` (system function registry)

Excel integration
- Expression member functions:
  - `src/main/java/com/scudata/expression/mfn/file/XlsOpen.java`
  - `src/main/java/com/scudata/expression/mfn/file/XlsImport.java`
  - `src/main/java/com/scudata/expression/mfn/file/XlsExport.java`
  - `src/main/java/com/scudata/expression/mfn/xo/XlsCell.java`
  - `src/main/java/com/scudata/expression/mfn/xo/XlsMove.java`
- Backend:
  - `src/main/java/com/scudata/excel/ExcelTool.java`
  - `src/main/java/com/scudata/excel/XlsFileObject.java`
  - `src/main/java/com/scudata/excel/FileXls.java`
  - `src/main/java/com/scudata/excel/SheetXls.java`

Chart rendering
- Expression surface:
  - `src/main/java/com/scudata/expression/fn/CreateCanvas.java`
  - `src/main/java/com/scudata/expression/mfn/canvas/Plot.java`
  - `src/main/java/com/scudata/expression/mfn/canvas/Draw.java`
  - `src/main/java/com/scudata/expression/CanvasFunction.java`
- Canvas bridge:
  - `src/main/java/com/scudata/dm/Canvas.java`
- Renderer:
  - `src/main/java/com/scudata/chart/Engine.java`

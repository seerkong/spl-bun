# esProc spreadsheet-style composer (Java reference)

This documents where the “Excel-like editor” logic lives in the original Java codebase and how it works, to guide future Bun/TypeScript parity work.

## Where the code lives (Java)
- `src/main/java/com/scudata/cellset/datamodel/CellSet.java` — grid model representing a sheet; tracks rows/cols, styles, cell references.
- `src/main/java/com/scudata/cellset/datamodel/PgmCellSet.java` — programmatic cellset used by the SPL editor; handles execution orchestration, dependency tracking, and persistence of a program sheet.
- `src/main/java/com/scudata/cellset/datamodel/NormalCell.java` and `PgmNormalCell.java` — individual cells that store expression text, value, dirty flags, formatting, and evaluation metadata (e.g., exceptions).
- `src/main/java/com/scudata/cellset/datamodel/Command.java` and `SqlCommand.java` — wrap executable commands (SPL/SQL) placed in cells; integrate with the expression parser and DB session/context.
- `src/main/java/com/scudata/cellset/CellRefUtil.java` — parses cell references (A1, B2, ranges) to resolve dependencies between cells.
- Supporting utils: `ICellSet`, `INormalCell`, `IRowCell`, `IColCell`, `BackGraphConfig` (render), and graph classes under `cellset/graph`.
- Expressions and evaluation are done via `com.scudata.expression.*` (parser, operators, functions) and DM context (`com.scudata.dm.Context`, etc.).

## How it works (high level)
1. **Sheet as program:** Each sheet (`PgmCellSet`) is treated as a program. Every cell (`PgmNormalCell`) contains an SPL expression or command string. Cells can reference others using Excel-like references (A1, B3:C5), parsed by `CellRefUtil`.
2. **Dependency resolution:** `PgmCellSet` walks the grid, builds dependency links via parsed references, and evaluates cells in an order that respects dependencies. Dirty flags trigger recomputation.
3. **Evaluation flow:** For a cell, the stored expression text is parsed by the expression engine (`com.scudata.expression.Expression`). Execution happens within a DM `Context` that provides variables, DB sessions, and function library access. `Command`/`SqlCommand` cells wrap SPL/SQL and use adapters to fetch data.
4. **Data model & styling:** `CellSet` tracks row/column metadata, cell styles, and serialization. `BackGraphConfig` and `graph` classes support rendering/visual behaviors in the editor.
5. **I/O:** The sheet/program can be loaded/saved; cells can import/export to Excel via `com.scudata.excel.*` utilities (Xls/Xlsx importers/exporters and paste helpers).

## Key takeaways for Bun/TypeScript porting
- The spreadsheet editor is essentially a cell-oriented program runner: grid model + dependency resolver + expression evaluator.
- Dependencies are explicit via A1-style references; a port should include a lightweight parser for cell references and an execution planner that honors dependency order.
- Execution context is the same expression/engine pipeline already ported (dataset ops, adapters); the “composer” façade can wrap this to expose a sheet-like API.
- Java uses no hidden DI here; orchestration is explicit in `PgmCellSet`. Keep side-effect management explicit (align with runtime设计模式) when recreating the feature in Bun.

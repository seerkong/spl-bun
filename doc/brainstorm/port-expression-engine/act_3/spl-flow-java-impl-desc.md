## Overview
Java esProc implements the multi-step, row/col-tagged flow as a program grid (PgmCellSet). Each cell stores an SPL expression or command and is executed in row-major order with control-flow commands that adjust the next cell pointer. Results live in the cell values and are returned by `result` or by the last calculable cell when no explicit result appears.

## Parse + Grid Build
- Input text is parsed into a grid by `CellSetUtil.toPgmCellSet`, using tab as column separator and newline as row separator; it also parses leading `#param` lines and assigns parameter values. Expressions are stored as raw strings in `PgmNormalCell` instances. `E:\infra-dev\src\esProc\src\main\java\com\scudata\util\CellSetUtil.java:635`
- Alias syntax `@alias:expr` is normalized into a regular cell expression and the alias is replaced with the cell id across the grid. `E:\infra-dev\src\esProc\src\main\java\com\scudata\util\CellSetUtil.java:792`
- Cell reference parsing is handled via `CellLocation.parse`, which parses A1-style refs into row/col indexes. `E:\infra-dev\src\esProc\src\main\java\com\scudata\common\CellLocation.java:155`
- Structural edits (insert/delete) adjust references with `CellRefUtil` to rewrite A1 references safely. `E:\infra-dev\src\esProc\src\main\java\com\scudata\cellset\CellRefUtil.java:144`

## Cell Classification and Command Parsing
- `PgmNormalCell.setExpString` classifies expressions by prefix:
  - `=` / `==` calculable cells/blocks
  - `>` / `>>` executable cells/blocks
  - `//` / `/` note blocks/cells
  - otherwise, command cells or constants
  `E:\infra-dev\src\esProc\src\main\java\com\scudata\cellset\datamodel\PgmNormalCell.java:61`
- Command cells are parsed by `Command.parse`, which recognizes control-flow keywords (`if`, `for`, `return`, `result`, etc.) and SQL command syntax (`$...`). `E:\infra-dev\src\esProc\src\main\java\com\scudata\cellset\datamodel\Command.java:252`
- SQL command parsing (`$@opt(db)sql;params`) is handled by `Command.parseSqlCommand`, producing a `SqlCommand` with sql, db, options, and params. `E:\infra-dev\src\esProc\src\main\java\com\scudata\cellset\datamodel\Command.java:316`

## Execution Order and Control Flow
- Execution starts at the first cell and proceeds row-major, skipping blanks and notes. `PgmCellSet.setNext` drives the next cell pointer and manages code block boundaries. `E:\infra-dev\src\esProc\src\main\java\com\scudata\cellset\datamodel\PgmCellSet.java:2098`
- The main loop (`runNext2`) dispatches based on command type (if/for/return/sql/etc.). `E:\infra-dev\src\esProc\src\main\java\com\scudata\cellset\datamodel\PgmCellSet.java:2195`
- Normal calculable/executable cells call `PgmNormalCell.calculate`, which builds an `Expression` and evaluates it inside the current `Context`. `E:\infra-dev\src\esProc\src\main\java\com\scudata\cellset\datamodel\PgmNormalCell.java:145`
- `return` and `result` commands collect their values into `resultValue` and mark the return location. `E:\infra-dev\src\esProc\src\main\java\com\scudata\cellset\datamodel\PgmCellSet.java:1846`

## SQL Command Execution
- `SqlCommand` decides query vs execute via keyword detection (`select`, `with`) and supports both logical and DB session SQL. `E:\infra-dev\src\esProc\src\main\java\com\scudata\cellset\datamodel\SqlCommand.java:20`
- `PgmCellSet.runSqlCmd` resolves the DB handle, evaluates params, executes query or update, and stores the result in the current cell. `E:\infra-dev\src\esProc\src\main\java\com\scudata\cellset\datamodel\PgmCellSet.java:1872`

## Result Semantics
- `PgmCellSet.execute` runs the grid until it hits a result/return, then returns a single value or sequence. If no result was encountered, it returns the last calculable cell value. `E:\infra-dev\src\esProc\src\main\java\com\scudata\cellset\datamodel\PgmCellSet.java:2949`
- `calculateResult` is the normal entry point used by utilities and JDBC helpers to run the grid. `E:\infra-dev\src\esProc\src\main\java\com\scudata\cellset\datamodel\PgmCellSet.java:2994`

## Notes for the TypeScript Port
- The Java flow is sequential, with control-flow commands altering the next cell pointer; the TS port currently executes in provided order only.
- Cell refs (A1/B2) are resolved via the evaluation context; keep explicit scope mapping per cell.
- SQL execution in Java is treated as a command; in TS this should map to db handle member calls (query/execute) with explicit adapters.
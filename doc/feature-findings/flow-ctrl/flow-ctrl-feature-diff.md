# Flow Control Feature Comparison: Java vs TypeScript

> Focus: **Flow Control (循环、条件分支、跳转)** implementation comparison
>
> Code scopes compared:
> - TypeScript: `spl-bun/packages/spl-flow`, `spl-bun/packages/composer`, `spl-bun/packages/web-server`
> - Java: `src/main/java/com/scudata/cellset/datamodel/`

## 0. Quick Status Summary

### TypeScript (packages/spl-flow + composer + web-server)
- Has a working **cell-based expression evaluator** with sequential execution
- Has **data source abstraction** (SQLite, CSV, JSON)
- Has **connection registry** and **DB handle** support
- Has **Excel import/export** via `T()` function
- **NO flow control statements** (if/for/break/continue/goto)
- **NO function definition** (func/return)
- **NO parallel execution** (fork)
- **NO exception handling** (try)
- **NO code block scoping** based on indentation

### Java (com.scudata.cellset.datamodel)
- Has a full **grid-based execution engine** (`PgmCellSet`)
- Has **complete flow control** (if/elseif/else, for, break, next, goto)
- Has **function definition and call** (func, return, result)
- Has **parallel execution** (fork, reduce, channel)
- Has **exception handling** (try)
- Has **code block scoping** via column indentation
- Has **execution stack** for nested control structures

## 1. Current TypeScript Implementation Inventory

### 1.1 Core Architecture (spl-flow)

| Component | File | Description |
|-----------|------|-------------|
| `evaluateFlow` | `src/index.ts` | Main entry point, sequential cell evaluation |
| `buildFlowAst` | `src/index.ts` | Builds AST from cell array (simple sequence) |
| `FlowCell` | `src/index.ts` | Cell definition: `{ row, col, expr }` |
| `FlowExecutionContext` | `src/index.ts` | Execution context with scope, connections, adapters |
| `ConnectionRegistry` | `src/connection/registry.ts` | Data source registration |
| `DataSourceFactory` | `src/datasource/factory.ts` | Creates SQLite/CSV/JSON data sources |

### 1.2 Execution Model (TypeScript)

```typescript
// Current execution: simple sequential loop
for (const cell of ast.block.flat()) {
  const expression = cell.expr;
  const compiled = compileExpression(expression, registry, memberRegistry);
  let value = compiled.evaluate(scope);
  if (value instanceof Promise) {
    value = await value;
  }
  scope[ref] = value;  // Store result by cell reference
}
```

**Key Characteristics:**
- ✅ Sequential execution of cells
- ✅ Cell reference resolution (A1, B2, etc.)
- ✅ Expression evaluation with scope
- ✅ Async/Promise support
- ❌ No control flow statements
- ❌ No code block detection
- ❌ No execution stack

### 1.3 Data Sources (TypeScript)

| Type | Implementation | Features |
|------|----------------|----------|
| SQLite | `SqliteDataSource` | query(), execute(), close() |
| CSV | `CsvDataSource` | query() with SQL-like filtering |
| JSON | `JsonDataSource` | query() with path extraction |

### 1.4 Runtime Functions (TypeScript)

| Function | Description | Java Equivalent |
|----------|-------------|-----------------|
| `connect(name)` | Get connection by name | `connect()` |
| `connect("sqlite", path)` | Create SQLite connection | `connect()` |
| `file(path)` | Create file handle | `file()` |
| `csv(content)` | Parse CSV string | - |
| `T(path)` | Read/write table files (CSV/JSON/Excel) | `T()` |

### 1.5 Composer Runtime

| Component | Description |
|-----------|-------------|
| `ComposerRuntime` | Pipeline execution runtime |
| `runPipeline` | Execute step-based pipeline |
| `createSqliteLoadStep` | Load data from SQLite |
| `createJoinPipelineStep` | Join datasets |
| `createWindowPipelineStep` | Window functions |
| `createComputePipelineStep` | Computed columns |
| `createFilterPipelineStep` | Filter rows |

## 2. Java Implementation Inventory

### 2.1 Core Architecture

| Component | File | Description |
|-----------|------|-------------|
| `PgmCellSet` | `PgmCellSet.java` | Grid execution engine (~3300 lines) |
| `PgmNormalCell` | `PgmNormalCell.java` | Program cell with type detection |
| `Command` | `Command.java` | Statement parser and type definitions |
| `CmdCode` | `PgmCellSet.java` (inner) | Execution stack frame |
| `ForCmdCode` | `PgmCellSet.java` (inner) | Loop control with 5 variants |
| `FuncInfo` | `PgmCellSet.java` (inner) | Function definition info |

### 2.2 Execution Model (Java)

```java
// Core execution loop
private CellLocation runNext2() {
    PgmNormalCell cell = getPgmNormalCell(curLct.getRow(), curLct.getCol());
    Command command = cell.getCommand();
    
    if (command == null) {
        cell.calculate();
        setNext(curLct.getRow(), curLct.getCol() + 1, false);
    } else {
        switch (command.getType()) {
            case Command.IF:      runIfCmd(cell, command); break;
            case Command.FOR:     runForCmd(cell, command); break;
            case Command.BREAK:   runBreakCmd(command); break;
            // ... more cases
        }
    }
    return curLct;
}
```

**Key Characteristics:**
- ✅ Grid-based execution with row/col positioning
- ✅ Code block detection via indentation (column position)
- ✅ Execution stack for nested structures
- ✅ Full flow control (if/for/break/continue/goto)
- ✅ Function definition and recursive calls
- ✅ Parallel execution (fork)
- ✅ Exception handling (try)

### 2.3 Statement Types (Java)

| Type | Constant | Description |
|------|----------|-------------|
| `IF` | 1 | Conditional branch |
| `ELSE` | 2 | Else branch |
| `ELSEIF` | 3 | Else-if branch |
| `FOR` | 4 | Loop (5 variants) |
| `CONTINUE` | 5 | Next iteration (keyword: `next`) |
| `BREAK` | 6 | Exit loop |
| `FUNC` | 8 | Function definition |
| `RETURN` | 9 | Return from function |
| `END` | 10 | Terminate execution |
| `RESULT` | 11 | Set grid return value |
| `SQL` | 12 | SQL statement (`$`) |
| `CLEAR` | 13 | Clear cell values |
| `FORK` | 15 | Parallel execution |
| `REDUCE` | 16 | Reduce parallel results |
| `GOTO` | 17 | Jump to cell |
| `CHANNEL` | 18 | Cursor pipeline |
| `TRY` | 19 | Exception handling |

### 2.4 Cell Types (Java)

| Type | Prefix | Description |
|------|--------|-------------|
| `TYPE_CALCULABLE_CELL` | `=` | Expression, returns value |
| `TYPE_CALCULABLE_BLOCK` | `==` | Expression block |
| `TYPE_EXECUTABLE_CELL` | `>` | Execute, no return |
| `TYPE_EXECUTABLE_BLOCK` | `>>` | Execute block |
| `TYPE_NOTE_CELL` | `/` | Comment |
| `TYPE_NOTE_BLOCK` | `//` | Comment block |
| `TYPE_COMMAND_CELL` | keyword | Flow control statement |
| `TYPE_CONST_CELL` | none | Constant value |
| `TYPE_BLANK_CELL` | empty | Empty cell |

### 2.5 Loop Implementations (Java)

| Class | Trigger | Description |
|-------|---------|-------------|
| `EndlessForCmdCode` | `for` (no args) | Infinite loop |
| `IntForCmdCode` | `for n` or `for a,b,c` | Integer range |
| `SequenceForCmdCode` | `for sequence` | Sequence iteration |
| `BoolForCmdCode` | `for condition` | While loop |
| `CursorForCmdCode` | `for cursor` | Cursor iteration |

## 3. Feature Gap Analysis

### 3.1 Flow Control Statements

| Feature | Java | TypeScript | Gap |
|---------|------|------------|-----|
| `if condition` | ✅ `runIfCmd()` | ❌ | **MISSING** |
| `else` | ✅ `toElseCmd()` | ❌ | **MISSING** |
| `elseif condition` | ✅ `runIfCmd()` | ❌ | **MISSING** |
| `for n` (count) | ✅ `IntForCmdCode` | ❌ | **MISSING** |
| `for a,b,c` (range) | ✅ `IntForCmdCode` | ❌ | **MISSING** |
| `for sequence` | ✅ `SequenceForCmdCode` | ❌ | **MISSING** |
| `for condition` (while) | ✅ `BoolForCmdCode` | ❌ | **MISSING** |
| `for cursor` | ✅ `CursorForCmdCode` | ❌ | **MISSING** |
| `for` (infinite) | ✅ `EndlessForCmdCode` | ❌ | **MISSING** |
| `break` | ✅ `runBreakCmd()` | ❌ | **MISSING** |
| `break A1` (labeled) | ✅ `runBreakCmd()` | ❌ | **MISSING** |
| `next` (continue) | ✅ `runContinueCmd()` | ❌ | **MISSING** |
| `next A1` (labeled) | ✅ `runContinueCmd()` | ❌ | **MISSING** |
| `goto A1` | ✅ `runGotoCmd()` | ❌ | **MISSING** |

### 3.2 Function Definition

| Feature | Java | TypeScript | Gap |
|---------|------|------------|-----|
| `func name(args)` | ✅ `FuncInfo` | ❌ | **MISSING** |
| `func@i` (non-recursive) | ✅ `isRecursiveMode()` | ❌ | **MISSING** |
| `func@m` (macro mode) | ✅ `isMacroMode()` | ❌ | **MISSING** |
| `return value` | ✅ `runReturnCmd()` | ❌ | **MISSING** |
| `result value` | ✅ `runReturnCmd()` | ❌ | **MISSING** |
| Recursive calls | ✅ `executeFunc()` | ❌ | **MISSING** |
| Default parameters | ✅ `defaultValues` | ❌ | **MISSING** |

### 3.3 Parallel Execution

| Feature | Java | TypeScript | Gap |
|---------|------|------------|-----|
| `fork sequence` | ✅ `runForkCmd()` | ❌ | **MISSING** |
| `fork seq1, seq2` | ✅ `runForkCmd()` | ❌ | **MISSING** |
| `fork seq;hosts` (distributed) | ✅ `runForkxCmd()` | ❌ | **MISSING** |
| `reduce` | ✅ Supported | ❌ | **MISSING** |
| `channel cursor` | ✅ `runChannelCmd()` | ❌ | **MISSING** |
| Thread pool | ✅ `ThreadPool` | ❌ | **MISSING** |

### 3.4 Exception Handling

| Feature | Java | TypeScript | Gap |
|---------|------|------------|-----|
| `try` block | ✅ `runTryCmd()` | ❌ | **MISSING** |
| Error capture | ✅ `goCatch()` | ❌ | **MISSING** |
| `end` (terminate) | ✅ `runEndCmd()` | ❌ | **MISSING** |
| `end "message"` | ✅ `RetryException` | ❌ | **MISSING** |

### 3.5 Execution Infrastructure

| Feature | Java | TypeScript | Gap |
|---------|------|------------|-----|
| Grid model | ✅ `PgmCellSet` | ⚠️ Partial (FlowCell array) | **PARTIAL** |
| Cell type detection | ✅ `setExpString()` | ❌ | **MISSING** |
| Code block detection | ✅ `getCodeBlockEndRow()` | ❌ | **MISSING** |
| Execution stack | ✅ `LinkedList<CmdCode>` | ❌ | **MISSING** |
| Current position | ✅ `curLct` | ⚠️ Implicit (loop index) | **PARTIAL** |
| `setNext()` navigation | ✅ Full implementation | ❌ | **MISSING** |
| Loop sequence `#A1` | ✅ `getForCellRepeatSeq()` | ❌ | **MISSING** |

### 3.6 Existing TypeScript Features (Not in scope but present)

| Feature | TypeScript | Java Equivalent |
|---------|------------|-----------------|
| Expression evaluation | ✅ `depa-data-expression` | ✅ `Expression.java` |
| DB connection | ✅ `ConnectionRegistry` | ✅ `DBObject` |
| SQLite query | ✅ `SqliteDataSource` | ✅ JDBC |
| CSV import | ✅ `CsvDataSource` | ✅ `file().import()` |
| JSON import | ✅ `JsonDataSource` | ✅ `json()` |
| Excel import/export | ✅ `T()` with xlsx | ✅ `xlsimport/xlsexport` |
| Pipeline steps | ✅ `ComposerRuntime` | ✅ Step-based execution |

## 4. Implementation Priority

### P0 - Core Flow Control (Must Have)

| Feature | Complexity | Dependency |
|---------|------------|------------|
| Cell type detection | Low | None |
| Code block boundary | Medium | Cell type |
| Execution stack | Medium | None |
| `if/elseif/else` | Medium | Code block |
| `for` (integer) | Medium | Execution stack |
| `for` (sequence) | Medium | Execution stack |
| `break` | Low | Execution stack |
| `next` | Low | Execution stack |
| `return` | Low | None |

### P1 - Extended Flow Control (Should Have)

| Feature | Complexity | Dependency |
|---------|------------|------------|
| `for` (condition/while) | Low | P0 for |
| `for` (cursor) | Medium | Cursor support |
| `func` definition | Medium | Code block |
| Function calls | Medium | func definition |
| `goto` | Low | Execution stack |
| `try` exception | Medium | Execution stack |

### P2 - Advanced Features (Nice to Have)

| Feature | Complexity | Dependency |
|---------|------------|------------|
| `fork` parallel | High | Thread/Worker |
| `reduce` | High | fork |
| `channel` | High | Cursor, fork |
| Distributed fork | Very High | Network |

## 5. Summary Statistics

| Category | Java | TypeScript | Gap |
|----------|------|------------|-----|
| Flow Control Statements | 17 | 0 | **17** |
| Loop Variants | 5 | 0 | **5** |
| Function Features | 6 | 0 | **6** |
| Parallel Features | 4 | 0 | **4** |
| Exception Features | 3 | 0 | **3** |
| Cell Types | 9 | 1 (expression only) | **8** |
| **Total Flow Features** | **44** | **0** | **44** |

**Coverage:** TypeScript has implemented **0%** of Java's flow control functionality.

## 6. Recommended Implementation Approach

### Option A: Minimal Linear Script (Recommended for MVP)

Implement flow control without full grid model:
- Parse statements from expression strings
- Use indentation or braces for code blocks
- Implement execution stack for loops
- Skip grid-specific features (cell references in loops)

**Pros:** Faster to implement, simpler architecture
**Cons:** Not 100% SPL compatible

### Option B: Full Grid Model

Port the complete `PgmCellSet` architecture:
- 2D cell matrix with type detection
- Column-based code block scoping
- Full execution stack with `CmdCode`
- Cell reference in loop sequences (`#A1`)

**Pros:** Full SPL compatibility
**Cons:** Significant effort (~3000 lines of Java to port)

## 7. References

### TypeScript Implementation
- `packages/spl-flow/src/index.ts` - Main evaluation logic
- `packages/composer/src/runtime.ts` - Pipeline runtime
- `packages/web-server/src/server.ts` - HTTP server

### Java Implementation
- `src/main/java/com/scudata/cellset/datamodel/PgmCellSet.java` - Execution engine
- `src/main/java/com/scudata/cellset/datamodel/PgmNormalCell.java` - Cell implementation
- `src/main/java/com/scudata/cellset/datamodel/Command.java` - Statement parser

### Previous Analysis
- `doc/feature-findings/flow-ctrl/README.md` - Architecture overview
- `doc/feature-findings/flow-ctrl/execution-flow.md` - Execution flow diagrams
- `doc/feature-findings/flow-ctrl/ts-porting-guide.md` - Porting guide

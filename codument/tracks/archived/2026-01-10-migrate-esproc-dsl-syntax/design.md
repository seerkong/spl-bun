# Design: Migrate esProc DSL Syntax

## Reference
- **[Java esProc 行为分析](./java-analysis.md)** - Java 源码分析，包含 `connect()`、`db.query()`、`DBObject` 等核心实现细节

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        web-ide                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Univer Spreadsheet (Plain Text Mode)                 │   │
│  │  Cell Content: demo.query("select * from STATES")     │   │
│  └──────────────────────────────────────────────────────┘   │
│                           │                                  │
│                           ▼                                  │
│              POST /api/execute [expressions]                 │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                       web-server                             │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  ExecutionEngine                                      │   │
│  │  - connectionRegistry: Map<string, DBConnection>      │   │
│  │  - compileDSL(expression) → evaluate(context)        │   │
│  └──────────────────────────────────────────────────────┘   │
│                           │                                  │
│                           ▼                                  │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  spl-flow                                              │   │
│  │  - parseDSL() → DSLNode                              │   │
│  │  - compileDSL() → CompiledDSL                        │   │
│  │  - evaluate(context) → Result                        │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## DSL Node Types

### Current Types
```typescript
type DSLNodeType = "sql" | "if" | "return" | "expr";
```

### Proposed Extended Types
```typescript
type DSLNodeType =
  | "sql"           // $q("select...")
  | "if"            // if cond then a else b
  | "return"        // return expr
  | "expr"          // general expression
  | "memberCall"    // obj.method(args)
  | "globalCall";   // func(args)
```

## Parser Enhancement

### Member Function Syntax Pattern
```
<identifier>.<identifier>(<string-literal>)
<identifier>.<identifier>(<string-literal>, <expr>, ...)
```

Examples:
- `demo.query("select * from STATES")`
- `db.query("select * from users where id = ?", userId)`
- `demo.execute("insert into logs values (?)", msg)`

### Global Function Syntax Pattern
```
<identifier>(<args>)
```

Examples:
- `connect("demo")`
- `connect("org.sqlite.JDBC", "jdbc:sqlite:demo.db")`

## DSL Node Structures

### MemberCallNode
```typescript
interface MemberCallNode {
  type: "memberCall";
  expression: string;       // Original source
  object: string;           // "demo"
  method: string;           // "query"
  args: string[];           // ["select * from STATES"]
}
```

### GlobalCallNode
```typescript
interface GlobalCallNode {
  type: "globalCall";
  expression: string;       // Original source
  function: string;         // "connect"
  args: string[];           // ["demo"]
}
```

## Execution Context Enhancement

### Current Context
```typescript
interface DSLExecutionContext {
  scope?: Record<string, unknown>;
  refs?: Record<string, unknown>;
  adapters?: {
    sqliteQuery?: (options: { dbPath?: string; sql: string; params?: unknown[] }) => unknown | Promise<unknown>;
  };
  defaultDbPath?: string;
}
```

### Proposed Context
```typescript
interface DBConnection {
  name: string;
  type: "sqlite" | "jdbc";
  path?: string;
  driver?: string;
  url?: string;
}

interface DSLExecutionContext {
  scope?: Record<string, unknown>;
  refs?: Record<string, unknown>;

  // Database adapters
  adapters?: {
    sqliteQuery?: (options: {
      connection?: DBConnection;
      sql: string;
      params?: unknown[]
    }) => unknown | Promise<unknown>;

    connect?: (name: string) => DBConnection | Promise<DBConnection>;
  };

  // Pre-registered connections (e.g., "demo" -> DBConnection)
  connections?: Map<string, DBConnection>;

  // Legacy support
  defaultDbPath?: string;
}
```

## Member Function Registry

Map known member functions to handlers:

```typescript
const memberFunctions: Record<string, MemberFunctionHandler> = {
  query: async (obj, args, ctx) => {
    // obj is the connection name (resolved from scope or connections registry)
    const connection = ctx.connections?.get(obj) ?? { name: obj, type: "sqlite" };
    const sql = args[0];
    const params = args.slice(1);  // Remaining args are parameters for ? placeholders
    return ctx.adapters?.sqliteQuery?.({ connection, sql, params });
  },

  execute: async (obj, args, ctx) => {
    // Similar to query but for INSERT/UPDATE/DELETE
    const connection = ctx.connections?.get(obj) ?? { name: obj, type: "sqlite" };
    const sql = args[0];
    const params = args.slice(1);
    return ctx.adapters?.sqliteExecute?.({ connection, sql, params });
  }
};
```

## Parameterized Query Support

### SQL with ? Placeholders
```typescript
// Expression: demo.query("select * from users where id = ? and status = ?", userId, status)
// Parsed as:
{
  type: "memberCall",
  object: "demo",
  method: "query",
  args: [
    "select * from users where id = ? and status = ?",
    "userId",   // Variable reference
    "status"    // Variable reference
  ]
}

// Evaluated: args[0] is SQL, args[1:] resolved from scope
// adapter called with: { sql: "...", params: [123, "active"] }
```

### Argument Parsing
Arguments can be:
1. **String literals**: `"select..."`, `'value'`
2. **Variable references**: `userId`, `status`
3. **Numbers**: `123`, `45.6`

Parser extracts arguments and evaluation resolves variable references from scope.

## Global Function Registry

```typescript
const globalFunctions: Record<string, GlobalFunctionHandler> = {
  connect: async (args, ctx) => {
    const name = args[0];
    if (ctx.adapters?.connect) {
      return ctx.adapters.connect(name);
    }
    // Return a reference that can be used by member functions
    return { __type: "dbRef", name };
  }
};
```

## web-server Integration

### Before (Current)
```typescript
// Temporary workaround
function parseDemoQuery(expression: string) {
  const match = expression.match(/^(\w+)\.query\(["'](.+?)["']\)$/s);
  // ...
}

// Execute endpoint
const parsed = parseDemoQuery(expression);
if (parsed) {
  return executeQuery(db, parsed.sql);
}
```

### After (Proposed)
```typescript
import { compileDSL } from "depa-data-spl-flow";

// Pre-register demo connection
const connections = new Map([
  ["demo", { name: "demo", type: "sqlite", path: DB_PATH }]
]);

// Execute endpoint
const compiled = compileDSL(expression);
const result = await compiled.evaluate({
  connections,
  adapters: {
    sqliteQuery: ({ connection, sql, params }) => {
      const db = getDatabase(connection);
      return executeQuery(db, sql, params);
    }
  }
});
```

## Backward Compatibility

The `$q("sql")` syntax remains supported for simple cases:

```typescript
// Both work:
$q("select * from STATES")          // Legacy shortcut
demo.query("select * from STATES")  // esProc compatible
```

## Error Handling

```typescript
// Unknown object
demo2.query("...")  // Error: Connection "demo2" not found

// Unknown method
demo.unknown("...")  // Error: Unknown member function "unknown"

// Invalid syntax
demo.query()  // Error: query() requires at least 1 argument
```

## Trade-offs

### Option A: Full Expression Parser (Chosen)
- **Pro**: Complete esProc syntax support, extensible
- **Con**: More complex implementation, regex might not be sufficient

### Option B: Simple Pattern Matching
- **Pro**: Quick to implement
- **Con**: Limited extensibility, fragile for complex expressions

### Decision
Start with pattern matching for initial implementation, plan for full parser later.

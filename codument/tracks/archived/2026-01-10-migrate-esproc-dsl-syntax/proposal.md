# Proposal: Migrate esProc Java DSL Syntax to spl-flow

## Change ID
`migrate-esproc-dsl-syntax`

## Summary
Migrate the esProc Java version's DSL syntax (specifically `db.query("sql")` and `connect("datasource")`) to the TypeScript `spl-flow` package, replacing the temporary `$q("sql")` workaround. The web IDE will use expressions without the `=` prefix (plain text mode).

## Reference
- **[Java esProc 行为分析](./java-analysis.md)** - 详细的 Java 源码分析和行为总结

## Background

### Current State
- **Java esProc**: Uses `demo.query("select * from STATES")` syntax where `demo` is a database connection object created via `connect("demo")`
- **TypeScript spl-flow**: Currently only supports `$q("sql")` as a temporary shortcut for SQL queries
- **web-server**: Has a temporary `parseDemoQuery()` function that extracts SQL from `demo.query("...")` expressions (server.ts:58-77)
- **web-ide**: Uses plain text expressions without `=` prefix (NoFormulaEngine mode)

### Problem
The current `$q("sql")` syntax is inconsistent with the Java esProc implementation. Users familiar with Java esProc expect to write `demo.query("select...")` but this currently only works via server-side string parsing, not through proper DSL evaluation.

## Goals
1. Support `db.query("sql")` member function syntax in spl-flow
2. Support `connect("datasource")` global function to create database connections
3. Remove temporary workarounds in web-server
4. Maintain backward compatibility with existing `$q("sql")` syntax
5. Web IDE continues to work without `=` prefix

## Non-Goals
- Full esProc expression language compatibility (focus on database operations only)
- Excel formula syntax support (`=` prefix handling)
- Multiple database type support (focus on SQLite initially)

## Proposed Solution

### 1. Extend spl-flow Parser
Add support for member function call syntax:
```
<identifier>.<method>(<args>)
```

Parse `demo.query("sql")` as:
```typescript
{
  type: "memberCall",
  object: "demo",
  method: "query",
  args: ["select * from STATES"]
}
```

### 2. Add Global Functions
Support `connect("datasource")` syntax:
```typescript
{
  type: "globalCall",
  function: "connect",
  args: ["demo"]
}
```

### 3. Execution Context Enhancement
Extend `DSLExecutionContext` to support:
- Named database connections (not just `defaultDbPath`)
- Connection registry for `connect()` results

### 4. Update web-server
- Use spl-flow to parse and evaluate expressions
- Remove temporary `parseDemoQuery()` function
- Register database connections in execution context

## Impact Analysis

### Packages Affected
1. `depa-data-spl-flow` - Core DSL parsing and evaluation
2. `depa-data-web-server` - Remove temporary parsing, use spl-flow
3. `depa-data-web-shared` - Possibly add shared types for DB connections

### Breaking Changes
None - new syntax is additive, `$q("sql")` remains supported.

## Design Decisions (Based on Java esProc Analysis)

### 1. `connect()` Behavior (from Java code analysis)
**Java behavior** (Connect.java, EnvUtil.java, Env.java):
- `connect("datasource")` looks up a pre-registered `ISessionFactory` by name from `Env.getDBSessionFactory(name)`
- Creates a `DBObject` wrapping a `DBSession` (which holds the actual JDBC `Connection`)
- Returns the `DBObject` instance that can be used for method calls like `.query()`
- Connection factories are pre-registered via `Env.setDBSessionFactory(name, factory)`

**TypeScript design**:
- `connect("demo")` returns a `DBConnection` object with connection metadata
- Pre-register connections in execution context's `connections` Map
- The connection object is passed to adapters for actual database operations
- Connections are reused (long-lived) during the session

### 2. Connection Lifecycle
**Decision**: Long-lived connections (validation phase)
- Connections are created once and reused throughout the server lifetime
- No connection pooling for now (can be added later)
- Server maintains a Map of named connections initialized at startup

### 3. Parameterized Queries
**Java behavior** (Query.java, DatabaseUtil.java):
- `db.query(sql, param1, param2, ...)` supports positional parameters
- SQL uses `?` placeholders, parameters are bound in order
- Parameters can have type hints: `db.query(sql, param:type, ...)`
- Supports `Sequence` (array) parameters that expand to multiple `?`

**TypeScript design**:
- Support `db.query("select * from users where id = ?", userId)` syntax
- Parameters passed as array to adapter: `params: [userId]`
- Type hints deferred to future enhancement

## Timeline
This is a medium-sized change affecting 2-3 packages with estimated 5-7 implementation tasks.

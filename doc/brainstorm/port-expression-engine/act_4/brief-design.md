# Data Source Connection Design for spl-flow

## Document Purpose
This document outlines the design for adding multi-data-source connection support to `packages/spl-flow`, enabling connections to multiple SQLite databases, CSV files, and JSON files.

---

## 1. Design Goals

### Primary Goals
1. **Multi-Database Support**: Connect to multiple SQLite databases simultaneously
2. **CSV File Support**: Query CSV files as data sources
2. **JSON File Support**: Query JSON files as data sources
3. **Unified API**: Consistent interface for all data source types
4. **Backward Compatibility**: Existing code continues to work without changes

### Non-Goals (Out of Scope)
- Excel file support
- XML file support
- JDBC/PostgreSQL/MySQL support
- Virtual database (VDB) abstraction
- Parallel operations
- Cursor operations

---

## 2. Architecture Overview

### 2.1 Current Architecture

```
packages/spl-flow/src/index.ts
├── DBConnection interface (name, type, path, driver, url)
├── FlowExecutionContext (connections Map, adapters)
├── createDbHandle() - Creates DB handle with query/execute/commit/rollback
└── evaluateFlow() - Evaluates cells with connection support
```

**Current Limitations:**
- Only supports SQLite connections
- No CSV file support
- No JSON file support
- Connection configuration is minimal
- No file-based data source abstraction

### 2.2 Proposed Architecture

```
packages/spl-flow/src/
├── index.ts (existing, minimal changes)
├── datasource/
│   ├── types.ts - Data source type definitions
│   ├── factory.ts - Data source factory
│   ├── sqlite.ts - SQLite data source implementation
│   ├── csv.ts - CSV data source implementation
│   └── json.ts - JSON data source implementation
└── connection/
    ├── registry.ts - Connection registry
    └── handle.ts - Data source handle creation
```

---

## 3. Design Pattern: Simplified Factory Pattern

Following Java's `ISessionFactory` pattern but simplified for TypeScript:

```typescript
// Base interface for all data sources
interface DataSource {
  type: "sqlite" | "csv" | "json";
  name: string;
  query(sql: string, params?: unknown[]): Promise<QueryResult>;
  close?(): Promise<void>;
}

// Factory creates data sources from configuration
interface DataSourceFactory {
  create(config: DataSourceConfig): DataSource;
}

// Configuration for data sources
type DataSourceConfig = SqliteConfig | CsvConfig | JsonConfig;

interface SqliteConfig {
  type: "sqlite";
  name: string;
  path: string;
}

interface CsvConfig {
  type: "csv";
  name: string;
  path: string;
  delimiter?: string;
  hasHeader?: boolean;
  encoding?: string;
}

interface JsonConfig {
  type: "json";
  name: string;
  path: string;
  encoding?: string;
  arrayPath?: string; // JSONPath to array of records
}
```

---

## 4. Component Design

### 4.1 Data Source Types (`datasource/types.ts`)

**Purpose:** Define interfaces and types for data sources

```typescript
export interface QueryResult {
  columns: string[];
  rows: unknown[][];
}

export interface DataSource {
  type: "sqlite" | "csv" | "json";
  name: string;
  query(sql: string, params?: unknown[]): Promise<QueryResult>;
  execute?(sql: string, params?: unknown[]): Promise<{ changes: number }>;
  close?(): Promise<void>;
}

export interface SqliteConfig {
  type: "sqlite";
  name: string;
  path: string;
}

export interface CsvConfig {
  type: "csv";
  name: string;
  path: string;
  delimiter?: string;
  hasHeader?: boolean;
  encoding?: string;
}

export interface JsonConfig {
  type: "json";
  name: string;
  path: string;
  encoding?: string;
  arrayPath?: string; // JSONPath to array of records (e.g., "$.data.users")
}

export type DataSourceConfig = SqliteConfig | CsvConfig | JsonConfig;
```

**Design Rationale:**
- `DataSource` interface provides unified API for all source types
- `execute()` is optional (CSV and JSON don't support writes)
- `close()` is optional for cleanup
- Configuration types are discriminated unions for type safety
- `arrayPath` in JsonConfig supports nested JSON structures

---

### 4.2 SQLite Data Source (`datasource/sqlite.ts`)

**Purpose:** Implement SQLite database connections

```typescript
import { Database } from "bun:sqlite";
import type { DataSource, SqliteConfig, QueryResult } from "./types";

export class SqliteDataSource implements DataSource {
  readonly type = "sqlite";
  readonly name: string;
  private db: Database;

  constructor(config: SqliteConfig) {
    this.name = config.name;
    this.db = new Database(config.path);
  }

  async query(sql: string, params?: unknown[]): Promise<QueryResult> {
    const stmt = this.db.query(sql);
    const rows = params ? stmt.all(...params) : stmt.all();

    // Extract columns from first row or statement
    const columns = rows.length > 0
      ? Object.keys(rows[0])
      : stmt.columns().map(c => c.name);

    // Convert rows to array format
    const rowArrays = rows.map(row =>
      columns.map(col => (row as any)[col])
    );

    return { columns, rows: rowArrays };
  }

  async execute(sql: string, params?: unknown[]): Promise<{ changes: number }> {
    const stmt = this.db.query(sql);
    const result = params ? stmt.run(...params) : stmt.run();
    return { changes: result.changes };
  }

  async close(): Promise<void> {
    this.db.close();
  }
}
```

**Design Rationale:**
- Uses Bun's native SQLite support
- Converts object rows to array format for consistency
- Supports parameterized queries
- Provides execute() for write operations

---

### 4.3 CSV Data Source (`datasource/csv.ts`)

**Purpose:** Implement CSV file reading with SQL-like query support

```typescript
import { readFileSync } from "fs";
import type { DataSource, CsvConfig, QueryResult } from "./types";

export class CsvDataSource implements DataSource {
  readonly type = "csv";
  readonly name: string;
  private config: CsvConfig;
  private data: QueryResult | null = null;

  constructor(config: CsvConfig) {
    this.name = config.name;
    this.config = config;
  }

  private loadData(): QueryResult {
    if (this.data) return this.data;

    const content = readFileSync(this.config.path,
      this.config.encoding || "utf-8");
    const delimiter = this.config.delimiter || ",";
    const hasHeader = this.config.hasHeader !== false; // default true

    const lines = content.split("\n").filter(line => line.trim());
    if (lines.length === 0) {
      return { columns: [], rows: [] };
    }

    const parseLine = (line: string): string[] => {
      // Simple CSV parsing (doesn't handle quoted delimiters)
      return line.split(delimiter).map(cell => cell.trim());
    };

    let columns: string[];
    let dataLines: string[];

    if (hasHeader) {
      columns = parseLine(lines[0]);
      dataLines = lines.slice(1);
    } else {
      // Generate column names: col1, col2, col3, ...
      const firstRow = parseLine(lines[0]);
      columns = firstRow.map((_, i) => `col${i + 1}`);
      dataLines = lines;
    }

    const rows = dataLines.map(line => parseLine(line));

    this.data = { columns, rows };
    return this.data;
  }

  async query(sql: string, params?: unknown[]): Promise<QueryResult> {
    const data = this.loadData();

    // For CSV, we'll use a simple in-memory SQLite database
    // to execute SQL queries against the loaded data
    const { Database } = await import("bun:sqlite");
    const tempDb = new Database(":memory:");

    // Create table from CSV data
    const columnDefs = data.columns.map(col => `"${col}" TEXT`).join(", ");
    tempDb.run(`CREATE TABLE csv_data (${columnDefs})`);

    // Insert data
    const placeholders = data.columns.map(() => "?").join(", ");
    const insertStmt = tempDb.prepare(
      `INSERT INTO csv_data VALUES (${placeholders})`
    );

    for (const row of data.rows) {
      insertStmt.run(...row);
    }

    // Execute query
    const stmt = tempDb.query(sql);
    const rows = params ? stmt.all(...params) : stmt.all();

    const columns = rows.length > 0
      ? Object.keys(rows[0])
      : stmt.columns().map(c => c.name);

    const rowArrays = rows.map(row =>
      columns.map(col => (row as any)[col])
    );

    tempDb.close();

    return { columns, rows: rowArrays };
  }

  async close(): Promise<void> {
    this.data = null;
  }
}
```

**Design Rationale:**
- Loads CSV file into memory on first query
- Uses in-memory SQLite to execute SQL queries against CSV data
- Supports SQL filtering, sorting, aggregation on CSV files
- Simple CSV parsing (can be enhanced later with proper CSV parser)
- Caches loaded data for performance

**Alternative Approach (Simpler):**
- Could implement basic filtering without SQL
- Would require custom query parser
- Less flexible but more lightweight

---

### 4.4 JSON Data Source (`datasource/json.ts`)

**Purpose:** Implement JSON file reading with SQL-like query support

```typescript
import { readFileSync } from "fs";
import type { DataSource, JsonConfig, QueryResult } from "./types";

export class JsonDataSource implements DataSource {
  readonly type = "json";
  readonly name: string;
  private config: JsonConfig;
  private data: QueryResult | null = null;

  constructor(config: JsonConfig) {
    this.name = config.name;
    this.config = config;
  }

  private loadData(): QueryResult {
    if (this.data) return this.data;

    const content = readFileSync(this.config.path,
      this.config.encoding || "utf-8");
    const jsonData = JSON.parse(content);

    // Extract array of records
    let records: any[];
    if (this.config.arrayPath) {
      // Simple JSONPath support (e.g., "$.data.users" or "data.users")
      records = this.extractByPath(jsonData, this.config.arrayPath);
    } else if (Array.isArray(jsonData)) {
      records = jsonData;
    } else {
      // If root is object, treat it as single record
      records = [jsonData];
    }

    if (!Array.isArray(records) || records.length === 0) {
      return { columns: [], rows: [] };
    }

    // Extract columns from first record
    const firstRecord = records[0];
    const columns = typeof firstRecord === "object" && firstRecord !== null
      ? Object.keys(firstRecord)
      : ["value"];

    // Convert records to row arrays
    const rows = records.map(record => {
      if (typeof record === "object" && record !== null) {
        return columns.map(col => record[col]);
      } else {
        return [record];
      }
    });

    this.data = { columns, rows };
    return this.data;
  }

  private extractByPath(obj: any, path: string): any {
    // Remove leading $. if present
    const cleanPath = path.replace(/^\$\./, "");
    const parts = cleanPath.split(".");

    let current = obj;
    for (const part of parts) {
      if (current == null) return [];
      current = current[part];
    }

    return current;
  }

  async query(sql: string, params?: unknown[]): Promise<QueryResult> {
    const data = this.loadData();

    // Use in-memory SQLite to execute SQL queries against JSON data
    const { Database } = await import("bun:sqlite");
    const tempDb = new Database(":memory:");

    // Create table from JSON data
    const columnDefs = data.columns.map(col => `"${col}" TEXT`).join(", ");
    tempDb.run(`CREATE TABLE json_data (${columnDefs})`);

    // Insert data
    const placeholders = data.columns.map(() => "?").join(", ");
    const insertStmt = tempDb.prepare(
      `INSERT INTO json_data VALUES (${placeholders})`
    );

    for (const row of data.rows) {
      insertStmt.run(...row);
    }

    // Execute query
    const stmt = tempDb.query(sql);
    const rows = params ? stmt.all(...params) : stmt.all();

    const columns = rows.length > 0
      ? Object.keys(rows[0])
      : stmt.columns().map(c => c.name);

    const rowArrays = rows.map(row =>
      columns.map(col => (row as any)[col])
    );

    tempDb.close();

    return { columns, rows: rowArrays };
  }

  async close(): Promise<void> {
    this.data = null;
  }
}
```

**Design Rationale:**
- Loads JSON file into memory on first query
- Supports nested JSON via `arrayPath` (simple JSONPath implementation)
- Uses in-memory SQLite to execute SQL queries against JSON data
- Handles both array and object root structures
- Caches loaded data for performance

**Supported JSON Formats:**
```json
// Format 1: Array at root
[
  {"id": 1, "name": "Alice"},
  {"id": 2, "name": "Bob"}
]

// Format 2: Nested array
{
  "data": {
    "users": [
      {"id": 1, "name": "Alice"},
      {"id": 2, "name": "Bob"}
    ]
  }
}
// Use arrayPath: "data.users"

// Format 3: Single object
{"id": 1, "name": "Alice"}
// Treated as single record
```

---

### 4.5 Data Source Factory (`datasource/factory.ts`)

**Purpose:** Create data source instances from configuration

```typescript
import type { DataSource, DataSourceConfig } from "./types";
import { SqliteDataSource } from "./sqlite";
import { CsvDataSource } from "./csv";
import { JsonDataSource } from "./json";

export class DataSourceFactory {
  static create(config: DataSourceConfig): DataSource {
    switch (config.type) {
      case "sqlite":
        return new SqliteDataSource(config);
      case "csv":
        return new CsvDataSource(config);
      case "json":
        return new JsonDataSource(config);
      default:
        throw new Error(`Unsupported data source type: ${(config as any).type}`);
    }
  }
}
```

**Design Rationale:**
- Simple factory pattern
- Type-safe with discriminated unions
- Easy to extend with new data source types

---

### 4.5 Connection Registry (`connection/registry.ts`)

**Purpose:** Manage named data source connections

```typescript
import type { DataSource, DataSourceConfig } from "../datasource/types";
import { DataSourceFactory } from "../datasource/factory";

export class ConnectionRegistry {
  private connections = new Map<string, DataSource>();

  register(config: DataSourceConfig): void {
    if (this.connections.has(config.name)) {
      throw new Error(`Connection '${config.name}' already registered`);
    }
    const dataSource = DataSourceFactory.create(config);
    this.connections.set(config.name, dataSource);
  }

  get(name: string): DataSource | undefined {
    return this.connections.get(name);
  }

  has(name: string): boolean {
    return this.connections.has(name);
  }

  async closeAll(): Promise<void> {
    for (const [name, ds] of this.connections) {
      if (ds.close) {
        await ds.close();
      }
    }
    this.connections.clear();
  }
}
```

**Design Rationale:**
- Centralized connection management
- Prevents duplicate connection names
- Supports cleanup via closeAll()

---

### 4.6 Data Source Handle Creation (`connection/handle.ts`)

**Purpose:** Create DB handles compatible with expression engine

```typescript
import { makeDbHandle } from "depa-data-expression";
import type { DataSource } from "../datasource/types";

export function createDataSourceHandle(dataSource: DataSource) {
  return makeDbHandle({
    name: dataSource.name,
    type: dataSource.type,
    query: async (sql: string, ...params: unknown[]) => {
      const result = await dataSource.query(sql, params.length ? params : undefined);
      return result;
    },
    execute: dataSource.execute
      ? async (sql: string, ...params: unknown[]) => {
          const result = await dataSource.execute!(sql, params.length ? params : undefined);
          return result;
        }
      : undefined,
    commit: async () => {
      // CSV and JSON don't support transactions
      if (dataSource.type === "sqlite") {
        await dataSource.execute?.("COMMIT", undefined);
      }
    },
    rollback: async () => {
      // CSV and JSON don't support transactions
      if (dataSource.type === "sqlite") {
        await dataSource.execute?.("ROLLBACK", undefined);
      }
    },
  });
}
```

**Design Rationale:**
- Adapts DataSource to expression engine's DB handle format
- Handles optional methods gracefully
- Transaction methods only work for SQLite

---

## 5. Integration with spl-flow

### 5.1 Updated FlowExecutionContext

```typescript
export interface FlowExecutionContext {
  scope?: Record<string, unknown>;

  // Option 1: Keep existing connections Map (backward compatible)
  connections?: Map<string, DBConnection>;

  // Option 2: Add new dataSourceConfigs (new approach)
  dataSourceConfigs?: DataSourceConfig[];

  // Option 3: Add ConnectionRegistry directly
  connectionRegistry?: ConnectionRegistry;

  defaultDbPath?: string;
  adapters?: {
    sqliteQuery?: (options: { connection?: DBConnection; dbPath?: string; sql: string; params?: unknown[] }) => unknown | Promise<unknown>;
    sqliteExecute?: (options: { connection?: DBConnection; dbPath?: string; sql: string; params?: unknown[] }) => unknown | Promise<unknown>;
    connect?: (name: string) => DBConnection | Promise<DBConnection>;
  };
}
```

**Recommended Approach:** Add `dataSourceConfigs` for new code, keep `connections` for backward compatibility.

### 5.2 Updated Connection Initialization

```typescript
function ensureDataSourceHandles(scope: Record<string, unknown>, ctx: FlowExecutionContext) {
  // Handle new data source configs
  if (ctx.dataSourceConfigs) {
    const registry = new ConnectionRegistry();
    for (const config of ctx.dataSourceConfigs) {
      registry.register(config);
      const dataSource = registry.get(config.name)!;
      scope[config.name] = createDataSourceHandle(dataSource);
    }
  }

  // Handle legacy connections (backward compatibility)
  if (ctx.connections) {
    for (const [name, connection] of ctx.connections.entries()) {
      if (!(name in scope)) {
        scope[name] = createDbHandle(connection, ctx);
      }
    }
  }
}
```

---

## 6. Usage Examples

### 6.1 Connect to Multiple SQLite Databases

```typescript
import { evaluateFlow } from "depa-data-spl-flow";

const result = await evaluateFlow(
  [
    { row: 1, col: "A", expr: 'db1.query("SELECT * FROM users")' },
    { row: 2, col: "A", expr: 'db2.query("SELECT * FROM products")' },
  ],
  {
    dataSourceConfigs: [
      { type: "sqlite", name: "db1", path: "./data/users.db" },
      { type: "sqlite", name: "db2", path: "./data/products.db" },
    ],
  }
);
```

### 6.2 Query CSV Files

```typescript
const result = await evaluateFlow(
  [
    { row: 1, col: "A", expr: 'sales.query("SELECT * FROM csv_data WHERE amount > 1000")' },
  ],
  {
    dataSourceConfigs: [
      {
        type: "csv",
        name: "sales",
        path: "./data/sales.csv",
        delimiter: ",",
        hasHeader: true,
      },
    ],
  }
);
```

### 6.3 Query JSON Files

```typescript
const result = await evaluateFlow(
  [
    { row: 1, col: "A", expr: 'users.query("SELECT * FROM json_data WHERE age > 25")' },
  ],
  {
    dataSourceConfigs: [
      {
        type: "json",
        name: "users",
        path: "./data/users.json",
        arrayPath: "data.users", // Optional: path to array in nested JSON
      },
    ],
  }
);
```

### 6.4 Mix SQLite, CSV, and JSON

```typescript
const result = await evaluateFlow(
  [
    { row: 1, col: "A", expr: 'db.query("SELECT id, name FROM users")' },
    { row: 2, col: "A", expr: 'sales.query("SELECT * FROM csv_data")' },
    { row: 3, col: "A", expr: 'config.query("SELECT * FROM json_data")' },
  ],
  {
    dataSourceConfigs: [
      { type: "sqlite", name: "db", path: "./data/users.db" },
      { type: "csv", name: "sales", path: "./data/sales.csv" },
      { type: "json", name: "config", path: "./data/config.json" },
    ],
  }
);
```

---

## 7. Implementation Phases

### Phase 1: Core Infrastructure
1. Create `datasource/types.ts` with interfaces
2. Create `datasource/factory.ts` with factory
3. Create `connection/registry.ts` with registry
4. Create `connection/handle.ts` with handle creation

### Phase 2: SQLite Implementation
1. Create `datasource/sqlite.ts`
2. Add tests for SQLite data source
3. Update `index.ts` to support dataSourceConfigs

### Phase 3: CSV Implementation
1. Create `datasource/csv.ts`
2. Add tests for CSV data source
3. Add integration tests for mixed sources

### Phase 4: JSON Implementation
1. Create `datasource/json.ts`
2. Add tests for JSON data source
3. Add integration tests for all three source types

### Phase 5: Documentation & Examples
1. Update README with usage examples
2. Add JSDoc comments
3. Create example scripts

---

## 8. Testing Strategy

### Unit Tests
- `datasource/sqlite.test.ts` - Test SQLite data source
- `datasource/csv.test.ts` - Test CSV data source
- `datasource/json.test.ts` - Test JSON data source
- `datasource/factory.test.ts` - Test factory
- `connection/registry.test.ts` - Test registry

### Integration Tests
- Test multiple SQLite connections
- Test CSV file queries
- Test JSON file queries
- Test mixed SQLite + CSV + JSON
- Test backward compatibility with existing connections

---

## 9. Future Enhancements (Out of Scope)

1. **Advanced CSV Parsing**: Handle quoted delimiters, escape sequences
2. **CSV Writing**: Support INSERT/UPDATE/DELETE on CSV files
3. **Advanced JSONPath**: Full JSONPath specification support
4. **JSON Writing**: Support INSERT/UPDATE/DELETE on JSON files
5. **Excel Support**: Read/write Excel files
6. **Connection Pooling**: Reuse connections efficiently
7. **Lazy Loading**: Load data sources on first use
8. **Caching**: Cache query results
9. **Streaming**: Stream large CSV/JSON files instead of loading into memory

---

## 10. Design Decisions & Trade-offs

### Decision 1: In-Memory SQLite for CSV/JSON Queries
**Rationale:** Reuse SQLite's query engine instead of building custom parser
**Trade-off:** Higher memory usage, but much more flexible and SQL-compatible
**Alternative:** Custom query parser (less flexible, more work)

### Decision 2: Simplified Factory Pattern
**Rationale:** TypeScript's type system makes complex factory hierarchies unnecessary
**Trade-off:** Less extensible than Java's approach, but simpler and more maintainable
**Alternative:** Full factory hierarchy like Java (overkill for 3 data source types)

### Decision 3: Backward Compatibility
**Rationale:** Existing code should continue to work
**Trade-off:** Slightly more complex initialization logic
**Alternative:** Breaking change (not acceptable)

### Decision 4: Async API
**Rationale:** File I/O and database operations are naturally async
**Trade-off:** All callers must use async/await
**Alternative:** Sync API (blocks event loop, not recommended)

### Decision 5: Simple JSONPath Implementation
**Rationale:** Most use cases only need basic nested object access
**Trade-off:** Limited JSONPath features (no wildcards, filters, etc.)
**Alternative:** Full JSONPath library (adds dependency, more complex)

---

## 11. References

**Java Implementation:**
- `E:\infra-dev\src\esProc\src\main\java\com\scudata\common\ISessionFactory.java`
- `E:\infra-dev\src\esProc\src\main\java\com\scudata\common\DBConfig.java`
- `E:\infra-dev\src\esProc\src\main\java\com\scudata\dm\FileObject.java`
- `E:\infra-dev\src\esProc\src\main\java\com\scudata\expression\fn\Connect.java`

**TypeScript Implementation:**
- `packages/spl-flow/src/index.ts` - Current implementation
- `packages/expression/src/types.ts` - DB handle types

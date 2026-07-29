# Data Source Connection Feature: Impact Analysis

## Document Purpose
This document analyzes the impact and modification points for adding multi-data-source connection support to `packages/spl-flow`.

---

## 1. Executive Summary

### Impact Level: **MEDIUM**

**New Files:** 7 files (all new, no modifications to existing files)
**Modified Files:** 1 file (`packages/spl-flow/src/index.ts` - minor changes)
**Breaking Changes:** None (backward compatible)
**Test Files:** 5-6 new test files

### Risk Assessment
- **Low Risk**: New functionality is additive, not modifying existing behavior
- **Backward Compatible**: Existing code continues to work unchanged
- **Isolated Changes**: New code is in separate modules

---

## 2. File-Level Impact Analysis

### 2.1 New Files (To Be Created)

#### `packages/spl-flow/src/datasource/types.ts`
**Purpose:** Type definitions for data sources
**Size:** ~70 lines
**Dependencies:** None
**Impact:** None (new file)

**Exports:**
- `QueryResult` interface
- `DataSource` interface
- `SqliteConfig` interface
- `CsvConfig` interface
- `JsonConfig` interface
- `DataSourceConfig` type

---

#### `packages/spl-flow/src/datasource/sqlite.ts`
**Purpose:** SQLite data source implementation
**Size:** ~50 lines
**Dependencies:** `bun:sqlite`, `./types`
**Impact:** None (new file)

**Exports:**
- `SqliteDataSource` class

**External Dependencies:**
- Bun's native SQLite support (already available)

---

#### `packages/spl-flow/src/datasource/csv.ts`
**Purpose:** CSV data source implementation
**Size:** ~100 lines
**Dependencies:** `fs`, `bun:sqlite`, `./types`
**Impact:** None (new file)

**Exports:**
- `CsvDataSource` class

**External Dependencies:**
- Node.js `fs` module (already available)
- Bun's SQLite for in-memory queries (already available)

**Performance Considerations:**
- Loads entire CSV into memory
- Creates temporary in-memory SQLite database per query
- May be slow for large CSV files (>100MB)

---

#### `packages/spl-flow/src/datasource/json.ts`
**Purpose:** JSON data source implementation
**Size:** ~120 lines
**Dependencies:** `fs`, `bun:sqlite`, `./types`
**Impact:** None (new file)

**Exports:**
- `JsonDataSource` class

**External Dependencies:**
- Node.js `fs` module (already available)
- Bun's SQLite for in-memory queries (already available)

**Performance Considerations:**
- Loads entire JSON into memory
- Creates temporary in-memory SQLite database per query
- May be slow for large JSON files (>100MB)
- Simple JSONPath implementation (no wildcards/filters)

---

#### `packages/spl-flow/src/datasource/factory.ts`
**Purpose:** Data source factory
**Size:** ~25 lines
**Dependencies:** `./types`, `./sqlite`, `./csv`, `./json`
**Impact:** None (new file)

**Exports:**
- `DataSourceFactory` class

---

#### `packages/spl-flow/src/connection/registry.ts`
**Purpose:** Connection registry
**Size:** ~40 lines
**Dependencies:** `../datasource/types`, `../datasource/factory`
**Impact:** None (new file)

**Exports:**
- `ConnectionRegistry` class

---

#### `packages/spl-flow/src/connection/handle.ts`
**Purpose:** Data source handle creation
**Size:** ~40 lines
**Dependencies:** `depa-data-expression`, `../datasource/types`
**Impact:** None (new file)

**Exports:**
- `createDataSourceHandle` function

---

### 2.2 Modified Files

#### `packages/spl-flow/src/index.ts`
**Current Size:** 264 lines
**Estimated Changes:** +30 lines, ~10 lines modified
**Impact Level:** LOW

**Changes Required:**

1. **Add Imports** (Lines 1-2)
   ```typescript
   // Add new imports
   import { ConnectionRegistry } from "./connection/registry";
   import { createDataSourceHandle } from "./connection/handle";
   import type { DataSourceConfig } from "./datasource/types";
   ```
   **Impact:** None (additive)

2. **Update FlowExecutionContext Interface** (Lines 41-50)
   ```typescript
   export interface FlowExecutionContext {
     scope?: Record<string, unknown>;
     connections?: Map<string, DBConnection>; // Keep for backward compatibility
     dataSourceConfigs?: DataSourceConfig[]; // NEW: Add this line
     defaultDbPath?: string;
     adapters?: {
       sqliteQuery?: (options: { connection?: DBConnection; dbPath?: string; sql: string; params?: unknown[] }) => unknown | Promise<unknown>;
       sqliteExecute?: (options: { connection?: DBConnection; dbPath?: string; sql: string; params?: unknown[] }) => unknown | Promise<unknown>;
       connect?: (name: string) => DBConnection | Promise<DBConnection>;
     };
   }
   ```
   **Impact:** Backward compatible (optional field)

3. **Update ensureDbHandles Function** (Lines 84-91)
   ```typescript
   function ensureDbHandles(scope: Record<string, unknown>, ctx: FlowExecutionContext) {
     // NEW: Handle data source configs
     if (ctx.dataSourceConfigs) {
       const registry = new ConnectionRegistry();
       for (const config of ctx.dataSourceConfigs) {
         registry.register(config);
         const dataSource = registry.get(config.name)!;
         scope[config.name] = createDataSourceHandle(dataSource);
       }
     }

     // EXISTING: Keep for backward compatibility
     if (!ctx.connections) return;
     for (const [name, connection] of ctx.connections.entries()) {
       if (!(name in scope)) {
         scope[name] = createDbHandle(connection, ctx);
       }
     }
   }
   ```
   **Impact:** Backward compatible (existing code path unchanged)

4. **Update buildFlowScope Function** (Lines 255-263)
   ```typescript
   export function buildFlowScope(ctx: FlowExecutionContext): Record<string, unknown> {
     const scope: Record<string, unknown> = {};

     // NEW: Handle data source configs
     if (ctx.dataSourceConfigs) {
       const registry = new ConnectionRegistry();
       for (const config of ctx.dataSourceConfigs) {
         registry.register(config);
         const dataSource = registry.get(config.name)!;
         scope[config.name] = createDataSourceHandle(dataSource);
       }
     }

     // EXISTING: Keep for backward compatibility
     if (ctx.connections) {
       for (const [name, connection] of ctx.connections.entries()) {
         scope[name] = createDbHandle(connection, ctx);
       }
     }

     return scope;
   }
   ```
   **Impact:** Backward compatible (existing code path unchanged)

5. **Add Exports** (End of file)
   ```typescript
   // NEW: Export new types and functions
   export type { DataSourceConfig, SqliteConfig, CsvConfig, JsonConfig } from "./datasource/types";
   export { ConnectionRegistry } from "./connection/registry";
   export { createDataSourceHandle } from "./connection/handle";
   ```
   **Impact:** None (additive)

**Backward Compatibility Analysis:**
- ✅ Existing tests continue to pass
- ✅ Existing code using `connections` Map continues to work
- ✅ No breaking changes to public API
- ✅ New functionality is opt-in via `dataSourceConfigs`

---

### 2.3 Test Files (To Be Created)

#### `packages/spl-flow/__tests__/datasource/sqlite.test.ts`
**Purpose:** Test SQLite data source
**Size:** ~100 lines
**Test Cases:**
- Create SQLite data source
- Execute queries with parameters
- Execute write operations
- Handle errors
- Close connection

---

#### `packages/spl-flow/__tests__/datasource/csv.test.ts`
**Purpose:** Test CSV data source
**Size:** ~150 lines
**Test Cases:**
- Load CSV with headers
- Load CSV without headers
- Execute SQL queries on CSV
- Handle different delimiters
- Handle encoding
- Handle errors

---

#### `packages/spl-flow/__tests__/datasource/json.test.ts`
**Purpose:** Test JSON data source
**Size:** ~150 lines
**Test Cases:**
- Load JSON array at root
- Load nested JSON with arrayPath
- Load single object as record
- Execute SQL queries on JSON
- Handle encoding
- Handle errors

---

#### `packages/spl-flow/__tests__/datasource/factory.test.ts`
**Purpose:** Test data source factory
**Size:** ~60 lines
**Test Cases:**
- Create SQLite data source
- Create CSV data source
- Create JSON data source
- Handle unknown types

---

#### `packages/spl-flow/__tests__/connection/registry.test.ts`
**Purpose:** Test connection registry
**Size:** ~80 lines
**Test Cases:**
- Register connections
- Retrieve connections
- Prevent duplicate names
- Close all connections

---

#### `packages/spl-flow/__tests__/integration/multi-source.test.ts`
**Purpose:** Integration tests for multiple data sources
**Size:** ~200 lines
**Test Cases:**
- Connect to multiple SQLite databases
- Query CSV files
- Query JSON files
- Mix SQLite, CSV, and JSON
- Backward compatibility with existing connections
- Error handling

---

### 2.4 Documentation Files (To Be Updated)

#### `packages/spl-flow/README.md`
**Changes Required:**
- Add section on multi-data-source support
- Add usage examples for SQLite, CSV, and JSON
- Document configuration options
**Estimated Size:** +150 lines

---

## 3. Dependency Impact

### 3.1 Internal Dependencies

**No Changes Required:**
- `depa-data-expression` - Already used, no changes needed
- `depa-data-core` - Not affected

### 3.2 External Dependencies

**No New Dependencies:**
- `bun:sqlite` - Already available in Bun runtime
- `fs` - Node.js built-in, already available
- No npm packages need to be added

### 3.3 Package.json Changes

**No Changes Required:**
- No new dependencies to add
- No version bumps required
- No script changes needed

---

## 4. API Impact Analysis

### 4.1 Public API Changes

#### New Exports (Additive)
```typescript
// New types
export type { DataSourceConfig, SqliteConfig, CsvConfig, JsonConfig };

// New classes
export { ConnectionRegistry };

// New functions
export { createDataSourceHandle };
```

**Impact:** None (additive only)

#### Modified Exports
```typescript
// FlowExecutionContext - add optional field
export interface FlowExecutionContext {
  // ... existing fields ...
  dataSourceConfigs?: DataSourceConfig[]; // NEW
}
```

**Impact:** Backward compatible (optional field)

### 4.2 Breaking Changes

**None** - All changes are backward compatible.

---

## 5. Performance Impact

### 5.1 Memory Impact

**SQLite Data Sources:**
- Minimal memory overhead (connection object only)
- Database files are not loaded into memory
- **Impact:** Negligible

**CSV Data Sources:**
- Entire CSV file loaded into memory on first query
- In-memory SQLite database created per query
- **Impact:** High for large CSV files (>100MB)

**JSON Data Sources:**
- Entire JSON file loaded into memory on first query
- In-memory SQLite database created per query
- **Impact:** High for large JSON files (>100MB)

**Mitigation:**
- Document memory limitations
- Consider streaming approach for large files (future enhancement)
- Add file size warnings in documentation

### 5.2 Performance Impact

**SQLite Data Sources:**
- Native Bun SQLite performance
- **Impact:** Negligible (same as existing implementation)

**CSV Data Sources:**
- File I/O on first query
- In-memory database creation per query
- **Impact:** Moderate (slower than native SQLite)

**JSON Data Sources:**
- File I/O on first query
- JSON parsing overhead
- In-memory database creation per query
- **Impact:** Moderate (slower than native SQLite)

**Benchmarks (Estimated):**
- Small files (<1MB): ~10-50ms per query
- Medium files (1-10MB): ~50-200ms per query
- Large files (>10MB): ~200ms-2s per query

**Mitigation:**
- Cache loaded data (already implemented)
- Consider persistent SQLite conversion (future enhancement)
- Document performance characteristics

### 5.3 Startup Impact

**Impact:** None
- Data sources are created lazily
- No initialization overhead
- Connections established on first use

---

## 6. Testing Impact

### 6.1 Existing Tests

**Impact:** None
- All existing tests should pass unchanged
- No modifications to existing test files required

**Verification Required:**
- Run `bun test packages/spl-flow/__tests__/dsl.test.ts`
- Ensure 100% pass rate

### 6.2 New Tests Required

**Unit Tests:** 5 files, ~530 lines
**Integration Tests:** 1 file, ~200 lines
**Total:** ~730 lines of test code

**Coverage Target:** >90% for new code

---

## 7. Build & Deployment Impact

### 7.1 Build Process

**Impact:** None
- No build script changes required
- TypeScript compilation unchanged
- No new build steps

### 7.2 Bundle Size

**Estimated Impact:** +8-12 KB (minified)
- New modules: ~450 lines of code
- No external dependencies added
- Tree-shaking will remove unused code

### 7.3 Deployment

**Impact:** None
- No configuration changes required
- No environment variable changes
- No migration scripts needed

---

## 8. Migration Path

### 8.1 For Existing Users

**No Migration Required:**
- Existing code continues to work unchanged
- `connections` Map still supported
- No breaking changes

**Optional Migration:**
```typescript
// Old approach (still works)
const ctx = {
  connections: new Map([
    ["demo", { name: "demo", type: "sqlite", path: "demo.db" }]
  ])
};

// New approach (recommended for new code)
const ctx = {
  dataSourceConfigs: [
    { type: "sqlite", name: "demo", path: "demo.db" },
    { type: "csv", name: "sales", path: "sales.csv" },
    { type: "json", name: "config", path: "config.json" }
  ]
};
```

### 8.2 For New Users

**Recommended Approach:**
- Use `dataSourceConfigs` for new code
- Simpler configuration
- Better type safety
- More flexible

---

## 9. Risk Assessment

### 9.1 Technical Risks

| Risk | Severity | Likelihood | Mitigation |
|------|----------|------------|------------|
| CSV/JSON memory usage for large files | High | Medium | Document limitations, add warnings |
| CSV/JSON query performance | Medium | High | Document performance, consider caching |
| Backward compatibility issues | High | Low | Comprehensive testing, keep old code paths |
| Type safety issues | Medium | Low | Use discriminated unions, strict TypeScript |
| Connection leaks | Medium | Low | Implement close() methods, document cleanup |
| JSONPath parsing errors | Low | Medium | Simple implementation, document limitations |

### 9.2 User Impact Risks

| Risk | Severity | Likelihood | Mitigation |
|------|----------|------------|------------|
| Confusion about two connection APIs | Low | Medium | Clear documentation, examples |
| Unexpected memory usage with CSV/JSON | Medium | Medium | Document memory requirements |
| Performance degradation | Low | Low | No impact on existing code paths |
| JSONPath syntax confusion | Low | Medium | Provide clear examples, document limitations |

---

## 10. Rollback Plan

### 10.1 Rollback Complexity: **LOW**

**Reason:** All changes are additive and isolated

**Rollback Steps:**
1. Remove new files in `datasource/` and `connection/` directories
2. Revert changes to `index.ts` (remove new imports and exports)
3. Remove new test files
4. Revert documentation changes

**Estimated Time:** <30 minutes

### 10.2 Data Impact

**None** - No data migration or schema changes

---

## 11. Implementation Checklist

### Phase 1: Core Infrastructure
- [ ] Create `datasource/types.ts`
- [ ] Create `datasource/factory.ts`
- [ ] Create `connection/registry.ts`
- [ ] Create `connection/handle.ts`
- [ ] Add unit tests for factory and registry

### Phase 2: SQLite Implementation
- [ ] Create `datasource/sqlite.ts`
- [ ] Add unit tests for SQLite data source
- [ ] Update `index.ts` to support `dataSourceConfigs`
- [ ] Add integration tests

### Phase 3: CSV Implementation
- [ ] Create `datasource/csv.ts`
- [ ] Add unit tests for CSV data source
- [ ] Add integration tests for mixed sources
- [ ] Performance testing for CSV queries

### Phase 4: JSON Implementation
- [ ] Create `datasource/json.ts`
- [ ] Add unit tests for JSON data source
- [ ] Test JSONPath functionality
- [ ] Add integration tests for all three source types
- [ ] Performance testing for JSON queries

### Phase 5: Documentation & Testing
- [ ] Update README with examples
- [ ] Add JSDoc comments to all public APIs
- [ ] Run full test suite
- [ ] Verify backward compatibility
- [ ] Create example scripts

### Phase 5: Review & Release
- [ ] Code review
- [ ] Performance benchmarks
- [ ] Documentation review
- [ ] Version bump (minor version)
- [ ] Release notes

---

## 12. Timeline Estimate

**Total Effort:** 3-4 days of focused work

- **Phase 1:** 4 hours (core infrastructure)
- **Phase 2:** 4 hours (SQLite implementation)
- **Phase 3:** 6 hours (CSV implementation)
- **Phase 4:** 6 hours (JSON implementation)
- **Phase 5:** 4 hours (documentation & testing)
- **Phase 6:** 2 hours (review & release)

**Note:** Timeline assumes single developer, no blockers

---

## 13. Success Criteria

### Functional Requirements
- ✅ Can connect to multiple SQLite databases
- ✅ Can query CSV files with SQL
- ✅ Can query JSON files with SQL
- ✅ JSONPath support for nested JSON structures
- ✅ Can mix SQLite, CSV, and JSON in same flow
- ✅ Backward compatible with existing code
- ✅ All tests pass

### Non-Functional Requirements
- ✅ Test coverage >90% for new code
- ✅ No performance regression for existing code
- ✅ Documentation complete with examples
- ✅ Type-safe API with no `any` types
- ✅ Memory usage documented and reasonable

---

## 14. Post-Implementation Monitoring

### Metrics to Track
1. **Adoption Rate:** Usage of `dataSourceConfigs` vs `connections`
2. **Performance:** Query times for CSV vs JSON vs SQLite
3. **Memory Usage:** Peak memory with large CSV/JSON files
4. **Error Rates:** Connection failures, query errors, JSONPath parsing errors
5. **User Feedback:** Issues, feature requests

### Monitoring Tools
- Unit test execution times
- Integration test memory profiling
- User-reported issues in GitHub

---

## 15. Future Enhancements (Out of Scope)

### High Priority
1. **Streaming CSV/JSON Support:** Handle large files without loading into memory
2. **CSV/JSON Write Support:** INSERT/UPDATE/DELETE operations
3. **Connection Pooling:** Reuse connections efficiently
4. **Advanced JSONPath:** Full JSONPath specification with wildcards and filters

### Medium Priority
5. **Excel Support:** Read/write Excel files
6. **Query Caching:** Cache query results for performance
7. **XML File Support:** Query XML files as data sources

### Low Priority
8. **Remote Data Sources:** HTTP/REST API data sources
9. **Database Migrations:** Schema versioning and migrations
10. **Connection Health Checks:** Monitor connection status

---

## 16. References

**Design Document:**
- `doc/brainstorm/port-expression-engine/act_4/brief-design.md`

**Feature Comparison:**
- `doc/brainstorm/port-expression-engine/act_4/engine-feature-diff.md`

**Current Implementation:**
- `packages/spl-flow/src/index.ts`
- `packages/spl-flow/__tests__/dsl.test.ts`

**Java Reference:**
- `E:\infra-dev\src\esProc\src\main\java\com\scudata\common\ISessionFactory.java`
- `E:\infra-dev\src\esProc\src\main\java\com\scudata\expression\fn\Connect.java`

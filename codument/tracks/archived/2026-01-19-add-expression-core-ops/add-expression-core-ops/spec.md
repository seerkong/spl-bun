## ADDED Requirements

### Requirement: Sequence member operations parity
The expression engine SHALL implement sequence member functions `select`, `sort`, `group`, `join`, and `derive` on existing sequence/table types, matching Java semantics and return shapes.

#### Scenario: select filters by expression
- **GIVEN** a sequence/table and a boolean expression string
- **WHEN** `seq.select(expr)` is evaluated
- **THEN** the returned sequence contains only items that satisfy the expression, matching Java behavior

#### Scenario: sort orders by expression
- **GIVEN** a sequence/table and a sort expression or key specification
- **WHEN** `seq.sort(...)` is evaluated
- **THEN** the result ordering matches Java semantics for the same inputs

#### Scenario: group aggregates into grouped sequences
- **GIVEN** a sequence/table and grouping keys or expressions
- **WHEN** `seq.group(...)` is evaluated
- **THEN** groups and group metadata match Java behavior for the same inputs

#### Scenario: join combines sequences by keys
- **GIVEN** two sequences/tables and join keys/specification
- **WHEN** `seq.join(other, ...)` is evaluated
- **THEN** the joined result matches Java semantics for the same inputs

#### Scenario: derive adds computed fields
- **GIVEN** a sequence/table and derived field expressions
- **WHEN** `seq.derive(...)` is evaluated
- **THEN** the result includes computed fields with Java-parity values

### Requirement: File member operations for CSV/JSON
The expression engine SHALL implement file member functions `read`, `write`, `import`, and `export` on existing file-related types, supporting CSV/JSON files only. SQLite access SHALL be via `connect(...)` returning a data source handle.

#### Scenario: read/import loads CSV/JSON files
- **GIVEN** a file handle pointing to a CSV/JSON file
- **WHEN** `file.read(...)` or `file.import(...)` is evaluated
- **THEN** the returned dataset/sequence matches Java semantics for the same file content

#### Scenario: connect handles SQLite data sources
- **GIVEN** a SQLite connection descriptor
- **WHEN** `connect("sqlite", ...)` is evaluated
- **THEN** it returns a SQLite data source handle (not a file handle) usable for queries

#### Scenario: write/export persists data to supported files
- **GIVEN** a dataset/sequence and a target CSV/JSON file
- **WHEN** `file.write(...)` or `file.export(...)` is evaluated
- **THEN** the persisted data matches Java semantics and format expectations

### Requirement: Cursor member operations parity
The expression engine SHALL implement cursor member functions `fetch` and `skip` on existing cursor types, matching Java semantics.

#### Scenario: fetch returns the next rows
- **GIVEN** a cursor over a dataset and a fetch size
- **WHEN** `cursor.fetch(n)` is evaluated
- **THEN** the next `n` rows are returned with Java-equivalent behavior

#### Scenario: skip advances the cursor
- **GIVEN** a cursor and a skip size
- **WHEN** `cursor.skip(n)` is evaluated
- **THEN** the cursor advances by `n` rows with Java-equivalent behavior

### Requirement: JSON and parse conversion functions
The expression engine SHALL implement `json_parse` and `json_stringify` conversion functions, and SHALL retain `json()` and `parse()` for compatibility. The `json()` function SHALL delegate to `json_parse` for string inputs and `json_stringify` for sequence/record inputs. The `parse()` function SHALL follow Java parse semantics and options.

#### Scenario: json_parse parses JSON strings
- **GIVEN** a JSON string
- **WHEN** `json_parse(str)` or `json(str)` is evaluated
- **THEN** the result is parsed into sequence/record structures matching Java behavior

#### Scenario: json_stringify serializes structures
- **GIVEN** a sequence/record
- **WHEN** `json_stringify(value)` or `json(value)` is evaluated
- **THEN** the result is a JSON string matching Java behavior

#### Scenario: parse converts string types
- **GIVEN** a string input and optional parse options
- **WHEN** `parse(str[, options])` is evaluated
- **THEN** the returned value matches Java parse semantics for the same inputs

### Requirement: Aggregations count and icount parity
The expression engine SHALL implement aggregation functions `count` and `icount`, matching Java semantics (including null/empty handling).

#### Scenario: count/icount result parity
- **GIVEN** datasets with null and non-null values
- **WHEN** `count` and `icount` are evaluated
- **THEN** results match Java behavior for the same inputs

### Requirement: spl-flow multi-data-source connections
`spl-flow` SHALL support multiple data source connections for SQLite, CSV, and JSON through `FlowExecutionContext` while preserving backward compatibility with the existing `connections` map and adapters.

#### Scenario: evaluateFlow with multiple data sources
- **GIVEN** a flow with expressions that query multiple SQLite/CSV/JSON sources
- **WHEN** `evaluateFlow` runs with `dataSourceConfigs`
- **THEN** all data sources are available in scope and queries execute successfully

#### Scenario: legacy connections remain supported
- **GIVEN** a flow using the existing `connections` map
- **WHEN** `evaluateFlow` runs without `dataSourceConfigs`
- **THEN** behavior is unchanged from the current implementation

### Requirement: Tests for new capabilities
The project SHALL add unit and integration tests covering the new sequence/file/cursor member functions, JSON/parse conversions, and spl-flow data source connections.

#### Scenario: tests cover new functions
- **GIVEN** the new functions and connection capabilities
- **WHEN** unit and integration tests are executed
- **THEN** all new tests pass

#### Scenario: connect builtins return data source handles
- **GIVEN** `connect("sqlite", path)` and `connect("sqlite", { path })`
- **WHEN** connect is evaluated in tests
- **THEN** it returns a SQLite data source handle usable by `query`/`execute` without Java-specific assumptions

## NON-FUNCTIONAL Requirements

### Requirement: Result parity focus
The implementation SHALL prioritize result parity with Java over matching error message text.

#### Scenario: Error message differences
- **GIVEN** an expression that fails in Java with a specific error message
- **WHEN** evaluated in the TypeScript engine
- **THEN** the error message may differ as long as failure semantics match Java

## OUT OF SCOPE
- XML conversion or XML data sources
- Additional aggregations beyond `count` and `icount` (for example `mode`, `rank`)
- Parallel operations, channels, VDB features, or Excel integration
- Additional conversion functions beyond `json` and `parse`
- Data sources beyond SQLite/CSV/JSON

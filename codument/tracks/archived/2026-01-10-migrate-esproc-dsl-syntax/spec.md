## ADDED Requirements

### Requirement: Member Function Call Syntax
The DSL parser must support member function call syntax for database operations.

#### Scenario: Parse db.query with simple SQL
- **GIVEN** the DSL source `demo.query("select * from STATES")`
- **WHEN** parseDSL is called
- **THEN** the result should be a MemberCallNode with type "memberCall", object "demo", method "query", args ["select * from STATES"]

#### Scenario: Parse db.query with parameterized SQL
- **GIVEN** the DSL source `db.query("select * from users where id = ?", userId)`
- **WHEN** parseDSL is called
- **THEN** the result should be a MemberCallNode with type "memberCall", object "db", method "query", args ["select * from users where id = ?", "userId"]

#### Scenario: Parse db.query with multiple parameters
- **GIVEN** the DSL source `demo.query("select * from t where a = ? and b = ?", x, y)`
- **WHEN** parseDSL is called
- **THEN** the result should be a MemberCallNode with type "memberCall", object "demo", method "query", args ["select * from t where a = ? and b = ?", "x", "y"]

#### Scenario: Parse db.execute for non-query operations
- **GIVEN** the DSL source `demo.execute("insert into logs (msg) values (?)", message)`
- **WHEN** parseDSL is called
- **THEN** the result should be a MemberCallNode with type "memberCall", object "demo", method "execute", args ["insert into logs (msg) values (?)", "message"]

### Requirement: Global Function Call Syntax
The DSL parser must support global function call syntax for creating database connections.

#### Scenario: Parse connect with datasource name
- **GIVEN** the DSL source `connect("demo")`
- **WHEN** parseDSL is called
- **THEN** the result should be a GlobalCallNode with type "globalCall", function "connect", args ["demo"]

#### Scenario: Parse connect with driver and URL
- **GIVEN** the DSL source `connect("org.sqlite.JDBC", "jdbc:sqlite:demo.db")`
- **WHEN** parseDSL is called
- **THEN** the result should be a GlobalCallNode with type "globalCall", function "connect", args ["org.sqlite.JDBC", "jdbc:sqlite:demo.db"]

### Requirement: Query Evaluation via Adapter
The compiled DSL must execute queries through the execution context's adapter.

#### Scenario: Evaluate db.query with registered connection
- **GIVEN** a compiled DSL from `demo.query("select * from STATES")`
- **AND** an execution context with connections Map containing "demo" and adapters.sqliteQuery mock function
- **WHEN** evaluate() is called
- **THEN** the sqliteQuery adapter should be called with connection, sql "select * from STATES", and params undefined or []

#### Scenario: Evaluate db.query with unknown connection
- **GIVEN** a compiled DSL from `unknown.query("select 1")`
- **AND** an execution context with no "unknown" connection registered
- **WHEN** evaluate() is called
- **THEN** an error should be thrown: "Connection 'unknown' not found"

#### Scenario: Evaluate db.query with parameters
- **GIVEN** a compiled DSL from `demo.query("select * from users where id = ?", userId)`
- **AND** an execution context with connections Map containing "demo", scope { userId: 123 }, and adapters.sqliteQuery mock function
- **WHEN** evaluate() is called
- **THEN** the sqliteQuery adapter should be called with connection, sql "select * from users where id = ?", and params [123]

#### Scenario: Evaluate db.query with multiple parameters
- **GIVEN** a compiled DSL from `demo.query("select * from t where a = ? and b = ?", x, y)`
- **AND** an execution context with connections Map containing "demo", scope { x: "foo", y: 42 }, and adapters.sqliteQuery mock function
- **WHEN** evaluate() is called
- **THEN** the sqliteQuery adapter should be called with sql "select * from t where a = ? and b = ?" and params ["foo", 42]

### Requirement: Backward Compatibility
The `$q("sql")` syntax must continue to work.

#### Scenario: Parse legacy $q syntax
- **GIVEN** the DSL source `$q("select * from STATES")`
- **WHEN** parseDSL is called
- **THEN** the result should be an SQLNode with type "sql" and expression containing "select * from STATES"

#### Scenario: Evaluate legacy $q syntax
- **GIVEN** a compiled DSL from `$q("select 1")`
- **AND** an execution context with sqliteQuery adapter
- **WHEN** evaluate() is called
- **THEN** the adapter should be called with the SQL

## MODIFIED Requirements

### Requirement: DSLExecutionContext Extensions
The execution context interface must be extended to support named connections.

#### Scenario: Context accepts connections map
- **GIVEN** a DSLExecutionContext with connections Map
- **WHEN** a memberCall node evaluates db.query
- **THEN** it should look up the connection by object name

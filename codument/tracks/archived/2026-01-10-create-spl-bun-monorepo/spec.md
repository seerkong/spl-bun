## ADDED Requirements

### Requirement: Bun workspace scaffold
The project SHALL provide a `spl-bun/` directory configured as a Bun workspace with root scripts for install/test/build and shared dependency management using TypeScript (no linting in v1).

#### Scenario: Workspace bootstrap
- **GIVEN** Bun is installed
- **WHEN** running `bun install` inside `spl-bun/`
- **THEN** the workspace dependencies install successfully and root scripts for test/build are available.

### Requirement: Multi-package layout
The Bun workspace SHALL define packages for the core runtime engine, SQLite adapter, and shared test utilities/fixtures, managed via Bun workspaces.

#### Scenario: Package discovery
- **GIVEN** the workspace is initialized
- **WHEN** listing workspaces via `bun workspaces` or inspecting the root config
- **THEN** packages for `core`, `sqlite-adapter`, and test utilities are present and linked.

### Requirement: Developer workflow docs
The workspace SHALL document basic developer commands (install, test, build) in `spl-bun/README.md`, noting TypeScript usage and that linting is deferred.

#### Scenario: Readme usage
- **GIVEN** a contributor opens `spl-bun/README.md`
- **WHEN** following the listed commands
- **THEN** they can install deps and run tests without additional setup beyond Bun.

### Requirement: Structure alignment with original
The workspace and packages SHALL preserve naming/directory structure parity with the original esProc where practical to aid cross-referencing.

#### Scenario: Naming parity
- **GIVEN** modules/classes mapped from the Java sources
- **WHEN** inspecting the TypeScript packages
- **THEN** corresponding file and class names are retained where feasible without breaking Bun/TypeScript conventions.

### Requirement: Step-based execution engine
The system SHALL execute SPL scripts as ordered steps/cells where each step can reference prior outputs and produces a dataset or scalar value.

#### Scenario: Sequential step evaluation
- **GIVEN** a script with Step1 loading a dataset and Step2 filtering Step1 results
- **WHEN** the engine runs the script
- **THEN** Step2 receives Step1 output, evaluates after Step1 completes, and returns the filtered dataset.

### Requirement: Dataset abstraction
The core runtime SHALL expose a dataset/table abstraction with schema metadata and support for iteration, projection, filtering, and aggregation operations (projection/filter/aggregate only in v1).

#### Scenario: Transform dataset
- **GIVEN** a dataset with numeric and string columns
- **WHEN** applying projection, filter, and aggregate operations through the runtime APIs
- **THEN** the runtime returns correctly shaped results with updated schema and computed aggregates.

### Requirement: Error propagation
The engine SHALL surface step failures with context (step identifier, operation, underlying error) and stop subsequent dependent steps.

#### Scenario: Adapter error bubbles up
- **GIVEN** a step that depends on a failed data fetch
- **WHEN** the fetch step throws an adapter error
- **THEN** the engine reports the error with step context and halts dependent step execution.

### Requirement: Operator scope guardrails
The engine SHALL exclude joins and windowing in v1, deferring them to future changes.

#### Scenario: Unsupported operator
- **GIVEN** a script that attempts a join/window operation
- **WHEN** the engine evaluates the step
- **THEN** it rejects the operation with a clear unsupported-feature error rather than executing it.

### Requirement: SQLite connection and query execution
The system SHALL provide a SQLite adapter that opens database files/URIs, executes SQL with optional parameters, and streams results.

#### Scenario: Parameterized query
- **GIVEN** a SQLite database file path and a SQL statement with placeholders
- **WHEN** executing via the adapter with provided parameters
- **THEN** the adapter returns rows for the parameterized query without mutating the DB.

### Requirement: Dataset integration
The adapter SHALL expose query results as core runtime datasets with schema metadata and row iteration compatible with core operations.

#### Scenario: Consume query results in engine
- **GIVEN** a core engine step that calls the SQLite adapter
- **WHEN** the adapter returns rows
- **THEN** the engine receives a dataset with correct column names/types usable by subsequent steps.

### Requirement: Error handling
The adapter SHALL propagate connection/query errors with details (SQL text, parameters, underlying message) to the core engine.

#### Scenario: Invalid SQL surfaces error
- **GIVEN** an invalid SQL statement
- **WHEN** the adapter executes it
- **THEN** an error is raised containing the SQL context and is surfaced to the engine, preventing downstream steps.

### Requirement: Bun test suite
The workspace SHALL include Bun-based automated tests that cover core engine behaviors and SQLite integration.

#### Scenario: Run tests workspace-wide
- **GIVEN** dependencies are installed
- **WHEN** running `bun test` at `spl-bun/`
- **THEN** tests execute across packages and report pass/fail for core and adapter coverage.

### Requirement: SQLite fixtures
Tests SHALL include fixtures to create/reset a SQLite database with seed data for repeatable runs.

#### Scenario: Reusable SQLite fixture
- **GIVEN** integration tests needing tables and sample rows
- **WHEN** invoking the fixture setup
- **THEN** a fresh SQLite database with seed tables is available and cleaned up after tests.

### Requirement: Engine behavior coverage
Tests SHALL validate step dependency resolution, dataset transformations, and error propagation paths.

#### Scenario: Step dependency test
- **GIVEN** a scripted sequence with dependent steps
- **WHEN** executing tests
- **THEN** assertions confirm outputs match expectations and failures block dependent steps.

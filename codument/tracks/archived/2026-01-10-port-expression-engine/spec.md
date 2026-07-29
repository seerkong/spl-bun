## MODIFIED Requirements

### Requirement: Dataset abstraction
The core runtime SHALL expose a dataset/table abstraction with schema metadata and support for iteration, projection, filtering, aggregation, join (inner/left), and window operations (row_number/rank/dense_rank/running_sum/running_avg with partition/order).

#### Scenario: Transform dataset
- **GIVEN** a dataset with numeric and string columns
- **WHEN** applying projection, filter, and aggregate operations through the runtime APIs
- **THEN** the runtime returns correctly shaped results with updated schema and computed aggregates.

#### Scenario: Transform dataset with joins
- **GIVEN** two datasets with a common key
- **WHEN** performing an inner or left join via the runtime APIs
- **THEN** the runtime returns a merged dataset with disambiguated column names and correct null-handling for non-matching rows.

#### Scenario: Apply window analytics
- **GIVEN** a dataset with partition and order columns and a numeric measure
- **WHEN** applying window functions (row_number, rank/dense_rank, running_sum/avg)
- **THEN** the runtime appends computed window columns with results scoped to each partition and ordered frame.

## ADDED Requirements

### Requirement: Expression parsing and evaluation
The core runtime SHALL parse esProc-style expressions into an AST and evaluate them with correct operator precedence, null/boolean semantics, and a pluggable function library (math/string/datetime/collection) without relying on `eval`.

#### Scenario: Evaluate expression over row context
- **GIVEN** a row `{a: 2, b: 5}` and expression `a + b * 2`
- **WHEN** the evaluator runs with the row bound as variables
- **THEN** it returns `12` and preserves operator precedence without mutating the row.

#### Scenario: Evaluate function and null semantics
- **GIVEN** an expression `nvl(name, "unknown")` where `name` is null
- **WHEN** the evaluator executes using the function registry
- **THEN** it returns the fallback string and does not throw; errors include expression text and position when evaluation fails.

### Requirement: Expression-driven step operations
The engine SHALL allow dataset and step definitions to accept expression strings for filters, computed columns, and join/window parameters, resolving variables from step outputs and row context with error messages that cite the step id and expression location.

#### Scenario: Filter step with expression
- **GIVEN** a dataset step output and a subsequent step that filters with expression `amount > 100 and status = "open"`
- **WHEN** the engine executes the filter step
- **THEN** rows are filtered accordingly and any missing column references raise a contextual error naming the step and expression.

#### Scenario: Window or join parameter via expression
- **GIVEN** a window step that computes `running_sum` over `value * 1.1` and a join step that uses `upper(customer_id)` as a key
- **WHEN** the engine evaluates these steps
- **THEN** expressions are resolved per row and step context, producing correct computed outputs or a clear error if the expression is invalid.

### Requirement: Expression evaluation coverage
The Bun test suite SHALL include unit and integration coverage for the expression parser/evaluator, including operators, function registry lookups, and dataset/engine integration paths.

#### Scenario: Expression unit tests
- **GIVEN** expression fixtures covering literals, arithmetic/comparison, logical short-circuit, and null-handling
- **WHEN** running `bun test`
- **THEN** the tests assert correct results and error messages for invalid expressions without relying on runtime `eval`.

#### Scenario: Integration tests with datasets and steps
- **GIVEN** datasets and engine steps that use expression strings for filters, computed columns, joins, or window outputs
- **WHEN** executing the Bun test suite
- **THEN** integration tests validate correct wiring to the evaluator and surface contextual errors when expressions reference missing columns or invalid syntax.

## REMOVED Requirements

### Requirement: Operator scope guardrails
**Reason**: Join and window operations are supported alongside expression-driven evaluations; the prior exclusion is obsolete.
**Migration**: Use the join/window and expression APIs instead of expecting unsupported-feature errors.

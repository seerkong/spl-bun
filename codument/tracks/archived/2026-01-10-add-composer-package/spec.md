## ADDED Requirements

### Requirement: Composer package in workspace
The monorepo SHALL include a `depa-data-composer` package that aggregates core engine, expression evaluator, and adapters into a cohesive entry point for SPL pipelines.

#### Scenario: Composer package available
- **WHEN** installing workspace dependencies
- **THEN** the `depa-data-composer` package is published/built alongside other packages and can be imported by downstream code.

### Requirement: Composition facade
The runtime SHALL expose a composition/facade layer that wires dataset operations, expression evaluation, and adapters (e.g., SQLite) so callers can run pipelines via a single API without manual step wiring, and it MUST manage external side effects using the documented runtime设计模式 (no implicit dependency injection).

#### Scenario: Run pipeline via composer
- **GIVEN** a set of step definitions (loads, expressions, joins/windows)
- **WHEN** invoking the composer facade to execute the pipeline
- **THEN** steps are assembled with the engine, expressions are evaluated, adapters are invoked, runtime contexts manage external side effects, and the final results are returned with appropriate error context.

### Requirement: Composer integration tests
The test harness SHALL include end-to-end tests that execute SPL pipelines through the composer, covering dataset loads (SQLite), expression evaluation, joins/windows, and result verification.

#### Scenario: Composer executes pipeline
- **GIVEN** fixtures with sample SQLite data and expression-driven steps
- **WHEN** running `bun test`
- **THEN** composer integration tests pass, proving the facade correctly orchestrates engine, expression, and adapter components.

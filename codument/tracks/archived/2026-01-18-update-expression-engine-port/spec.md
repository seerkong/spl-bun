## ADDED Requirements
### Requirement: Aggregation lifecycle parity (advanced)
The expression engine SHALL implement the full aggregation lifecycle parity with Java, including regather/finish phases and advanced aggregation gaps identified in the act_1 diff, so results match Java behavior for supported aggregations.

#### Scenario: Regather/finish lifecycle
- **GIVEN** aggregation functions requiring multi-phase gather (including regather/finish)
- **WHEN** the aggregation is evaluated over dataset rows
- **THEN** results match the Java engine for the same inputs

#### Scenario: Advanced aggregation coverage
- **GIVEN** aggregation functions listed as missing in `doc/brainstorm/port-expression-engine/act_1/feature-diff-20260116.md`
- **WHEN** those aggregations are executed in the TypeScript engine
- **THEN** results match Java for the same inputs

### Requirement: IO and table/record functions parity
The expression engine SHALL implement missing IO-related member/global functions (DB/File/Cursor) and table/record member functions in phases within this track, based on the Java FunctionLib and remaining gaps list.

#### Scenario: IO member/global functions
- **GIVEN** expressions using connect/query/execute/commit/rollback and related IO functions in Java
- **WHEN** evaluated in the TypeScript engine
- **THEN** results match Java behavior for the same inputs

#### Scenario: Table/record member functions
- **GIVEN** expressions using table/record member functions missing in TS
- **WHEN** evaluated in the TypeScript engine
- **THEN** results match Java behavior for the same inputs

### Requirement: Test coverage and gap scan
The project SHALL add unit and integration tests covering the new aggregation lifecycle and IO/table/record functions, and SHALL update the act_2 diff/summary documentation after tests pass. Newly discovered gaps MUST be appended to this track's plan.xml.

#### Scenario: Required tests
- **GIVEN** new lifecycle and IO/table features
- **WHEN** running unit tests in `packages/expression` and integration tests in `packages/core`
- **THEN** all new tests pass

#### Scenario: Post-test gap scan
- **GIVEN** tests are green
- **WHEN** scanning Java vs TypeScript expression engine
- **THEN** new diff and summary documents are created under `doc/brainstorm/port-expression-engine/act_2` with timestamped names (yyyyMMdd_HHmm), and new gaps are appended to this track's `plan.xml`

## NON-FUNCTIONAL Requirements
### Requirement: Result parity focus
The implementation SHALL prioritize result parity with Java over matching error message text.

#### Scenario: Error message differences
- **GIVEN** an expression that fails in Java with a specific error message
- **WHEN** evaluated in the TypeScript engine
- **THEN** the error message may differ as long as the failure semantics and results match Java

## OUT OF SCOPE
- UI changes or frontend integrations
- Refactoring unrelated expression engine code
- New external dependencies unless required by parity gaps

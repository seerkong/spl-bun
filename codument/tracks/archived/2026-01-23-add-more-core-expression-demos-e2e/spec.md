## Overview

This track adds comprehensive web-ide demos showcasing the newly implemented expression engine capabilities (sequence operations, file operations, cursor operations, multi-datasource connections), enhances the web-server/spl-flow integration, and implements end-to-end tests using Playwright to validate the complete workflow.

---

## ADDED Requirements

### Requirement: Sequence operation demos
The web-ide SHALL provide demos showcasing sequence member functions (select, sort, group, join, derive) with both simple and comprehensive examples.

#### Scenario: Simple sequence select demo
- **GIVEN** a demo database with sample data
- **WHEN** user loads the "Sequence Select" demo
- **THEN** the demo shows basic filtering using `select()` with clear results

#### Scenario: Comprehensive sequence operations demo
- **GIVEN** a demo database with relational data
- **WHEN** user loads the "Data Pipeline" demo
- **THEN** the demo combines select, sort, group, join, and derive in a realistic data processing scenario

#### Scenario: Sequence sort and group demo
- **GIVEN** a dataset with sortable and groupable fields
- **WHEN** user executes sort and group operations
- **THEN** results display correctly ordered and grouped data

### Requirement: File operation demos
The web-ide SHALL provide demos showcasing CSV and JSON file operations (read, write, import, export) with practical use cases.

#### Scenario: CSV file read demo
- **GIVEN** a CSV file in the demo data directory
- **WHEN** user loads the "CSV Import" demo
- **THEN** the demo reads and displays CSV data using file operations

#### Scenario: JSON file operations demo
- **GIVEN** JSON files with nested structures
- **WHEN** user loads the "JSON Processing" demo
- **THEN** the demo shows reading, parsing, transforming, and writing JSON data

#### Scenario: Multi-format data integration demo
- **GIVEN** both CSV and JSON data sources
- **WHEN** user loads the "Data Integration" demo
- **THEN** the demo combines data from different file formats

### Requirement: Cursor and multi-datasource demos
The web-ide SHALL provide demos showcasing cursor operations (fetch, skip) and multi-datasource connections (SQLite, CSV, JSON).

#### Scenario: Cursor pagination demo
- **GIVEN** a large dataset in SQLite
- **WHEN** user loads the "Cursor Pagination" demo
- **THEN** the demo uses fetch() and skip() to paginate through results

#### Scenario: Multi-datasource query demo
- **GIVEN** SQLite database, CSV file, and JSON file configured as data sources
- **WHEN** user loads the "Multi-Source Query" demo
- **THEN** the demo queries all three data sources and combines results

#### Scenario: Cross-datasource join demo
- **GIVEN** related data in different data sources
- **WHEN** user executes a cross-datasource join
- **THEN** results show correctly joined data from multiple sources

### Requirement: Web-server and spl-flow enhancements
The web-server and spl-flow packages SHALL be enhanced to properly support the new expression capabilities with appropriate adapters and connection handling.

#### Scenario: DataSourceConfig support in web-server
- **GIVEN** the new dataSourceConfigs API in spl-flow
- **WHEN** web-server initializes connections
- **THEN** it uses dataSourceConfigs to register SQLite, CSV, and JSON sources

#### Scenario: File datasource registration
- **GIVEN** CSV and JSON files in the demo data directory
- **WHEN** server starts
- **THEN** file datasources are registered and accessible via expressions

#### Scenario: Expression adapter integration
- **GIVEN** new expression capabilities (sequence/file/cursor operations)
- **WHEN** expressions are evaluated through web-server
- **THEN** all operations execute correctly with proper adapter support

### Requirement: End-to-end tests with Playwright
The project SHALL include Playwright-based E2E tests covering demo loading, expression execution, result validation, error handling, and multi-datasource scenarios.

#### Scenario: Demo loading and switching test
- **GIVEN** the web-ide is running with all demos
- **WHEN** E2E test loads and switches between demos
- **THEN** each demo loads correctly with expected initial state

#### Scenario: Expression execution test
- **GIVEN** a demo with sequence operations
- **WHEN** E2E test clicks "Run Sheet"
- **THEN** expressions execute and results display in AG Grid with correct data

#### Scenario: Multi-datasource execution test
- **GIVEN** a demo using SQLite, CSV, and JSON sources
- **WHEN** E2E test executes the demo
- **THEN** all datasources are queried successfully and results are correct

#### Scenario: Error handling test
- **GIVEN** a demo with intentional errors (invalid SQL, missing file)
- **WHEN** E2E test executes the demo
- **THEN** error messages display correctly in the UI

#### Scenario: Result validation test
- **GIVEN** demos with known expected outputs
- **WHEN** E2E test executes each demo
- **THEN** actual results match expected results (column names, row counts, data values)

### Requirement: Demo data preparation
The project SHALL include appropriate demo data files (CSV, JSON) and database tables to support all demo scenarios.

#### Scenario: CSV demo data files
- **GIVEN** the demo data directory
- **WHEN** server starts
- **THEN** CSV files with sample data are available for demos

#### Scenario: JSON demo data files
- **GIVEN** the demo data directory
- **WHEN** server starts
- **THEN** JSON files with nested structures are available for demos

#### Scenario: Extended database schema
- **GIVEN** the demo.db SQLite database
- **WHEN** demos require additional tables
- **THEN** database includes tables for cursor pagination and join scenarios

### Requirement: Two-process development workflow
The development and testing workflow SHALL support running frontend (web-ide) and backend (web-server) as separate processes as specified in package.json.

#### Scenario: Separate process startup
- **GIVEN** package.json scripts for dev:frontend and dev:backend
- **WHEN** developer runs both processes
- **THEN** frontend and backend start independently and communicate correctly

#### Scenario: E2E test process management
- **GIVEN** Playwright E2E tests
- **WHEN** tests run
- **THEN** tests start both frontend and backend processes, execute tests, and clean up

---

## NON-FUNCTIONAL Requirements

### Requirement: Demo clarity and documentation
Demos SHALL be self-explanatory with clear descriptions and comments explaining what each expression does.

#### Scenario: Demo descriptions
- **GIVEN** any demo in the demo list
- **WHEN** user views the demo
- **THEN** description clearly explains the purpose and features demonstrated

### Requirement: Test reliability
E2E tests SHALL be reliable and deterministic, avoiding flaky tests due to timing issues or race conditions.

#### Scenario: Test stability
- **GIVEN** E2E test suite
- **WHEN** tests run multiple times
- **THEN** results are consistent without random failures

### Requirement: Performance considerations
Demos and tests SHALL complete in reasonable time, with cursor demos handling large datasets efficiently.

#### Scenario: Demo execution time
- **GIVEN** any demo
- **WHEN** user executes the demo
- **THEN** results appear within 2 seconds for typical datasets

---

## OUT OF SCOPE

- XML file operations (not implemented in expression engine)
- Excel file operations (not implemented in expression engine)
- Parallel operations demos (not implemented in expression engine)
- Virtual database (VDB) demos (not implemented in expression engine)
- Real-time data streaming demos
- Authentication and authorization features
- Production deployment configuration
- Performance benchmarking tools
- Additional aggregation functions beyond count/icount (mode, rank, etc.)

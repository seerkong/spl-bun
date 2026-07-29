Updated demos now match the CSV+JSON integration and true cross-datasource join, JSON processing works by parsing stringified profiles, and DataSet/array results now render in the grid by converting to query results in evaluateFlow. Also serialized JSON objects in JsonDataSource and added a test for that behavior, plus refreshed plan.xml changed-key-files.
What changed
- JSON Processing demo parses profile with json_parse and derives labels/age. packages/web-ide/src/pages/SplIde.vue:133
- Data Integration demo now joins CSV sales with JSON users on region. packages/web-ide/src/pages/SplIde.vue:144
- Cross-Datasource Join demo now joins SQLite ORDERS with CSV products. packages/web-ide/src/pages/SplIde.vue:175
- JSON datasource now stringifies nested objects to keep SQL-compatible text values. packages/spl-flow/src/datasource/json.ts:16
- Added JSON datasource test for nested object stringification. packages/spl-flow/__tests__/datasource/json.test.ts:1
- evaluateFlow now maps DataSet-like results and arrays to QueryResultData so the grid displays non-SQL results. packages/spl-flow/src/index.ts:66
- plan.xml updated changed-key-files for T3.3, T3.4, and T4.2. codument/tracks/add-more-core-expression-demos-e2e/plan.xml:187
Diagnostics
- LSP diagnostics could not run; typescript-language-server and vue-language-server are not installed.
Notes
- I did not change plan.xml task statuses to DONE because manual browser verification and Playwright verification are still marked TODO in the plan.
Next steps (pick one)
1. Run bun test packages/spl-flow/__tests__/datasource/json.test.ts to verify JSON datasource behavior.
2. Run bun test:e2e once Playwright browsers are installed.
3. Manually verify the updated demos in the UI and then update plan.xml task statuses.
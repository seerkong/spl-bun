# Change: Add composer package for integrated SPL Bun runtime

## Why
- We need a single packaged entry point (similar to esProc Java composition) that bundles core engine, expression evaluator, and adapters so consumers can run SPL pipelines without wiring each module manually.
- Providing a composer aligns with the original code’s integration layer and simplifies reuse across apps/tests.

## What Changes
- Introduce a new `depa-data-composer` package under `spl-bun/packages` that exports a cohesive API/facade wrapping engine, expression, dataset helpers, and adapters.
- Mirror the Java integration responsibilities (load configuration, construct steps, bind expression evaluation, connect adapters such as SQLite) with TypeScript-friendly defaults.
- Add integration tests demonstrating end-to-end execution through the composer using datasets and SQLite fixtures.
- Enforce the runtime设计模式 for all external side-effect management (no implicit DI); ignore other Java-side effect mechanisms.

## Impact
- Affected specs: spl-bun-monorepo (new package), spl-core-engine (composition/facade behavior), spl-test-harness (integration coverage through composer).
- Affected code: new composer package, potential minor exports in core/expression/adapter to support the facade, new integration tests.

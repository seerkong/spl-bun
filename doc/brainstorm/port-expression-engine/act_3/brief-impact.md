## Affected Packages
- `packages/spl-flow`: execution engine for cell-based expressions and db calls.
- `packages/web-server`: /api/execute endpoint parsing and response shaping.
- `packages/web-shared`: ExecuteRequest type shape update.
- `packages/web-ide`: request payload shape and response usage for result grid.

## Affected Files (initial)
- `packages/web-shared/src/index.ts`: change ExecuteRequest shape.
- `packages/web-server/src/server.ts`: parse object payload and evaluate with new flow engine.
- `packages/web-server/__tests__/server.integration.test.ts`: update request helper payload.
- `packages/spl-flow/src/index.ts`: replace compileDSL with expression engine evaluation.
- `packages/spl-flow/__tests__/dsl.test.ts`: update tests if DSL parser changes or adapters removed.
- `packages/web-ide/src/pages/SplIde.vue`: send `{ flowDef }` payload and handle responses.

## API/Behavior Changes
- /api/execute request body changes from array to object: `{ flowDef: ExecuteExpression[] }`.
- spl-flow evaluation uses expression engine semantics (assignment, member calls, db handles), not custom DSL parser.
- Responses should always include `steps` and last query result for IDE rendering.

## Risks
- Compatibility: `$q(...)` shorthand might break if not mapped to a db handle member call.
- Scope handling: cell references must still resolve (A1/B2).
- Member call behavior: db handles must be wrapped with `makeDbHandle` so default member registry functions work.
- IDE regression: if response data is missing or shape differs, AG Grid stays empty.

## Tests/Verification
- Update web-server integration tests for new payload shape and expression engine behavior.
- Extend spl-flow tests to validate expression engine usage for member calls and refs.
- Run `bun test packages/spl-flow` and `bun test packages/web-server` once code changes land.
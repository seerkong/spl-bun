## Goal
Replace the spl-flow runtime with the new expression engine from act_2, align /api/execute to accept object payloads ("{ flowDef: [] }"), and restore IDE result rendering.

## Scope
- Update shared request/response types used by web-ide and web-server.
- Rework spl-flow evaluation to use expression engine evaluation with explicit scope/refs handling.
- Keep db access wired through the existing runtime design pattern (explicit adapters/handles).
- Fix server response to always return latest query results to the IDE.

## Approach
1) Payload shape
- Change ExecuteRequest from an array to an object: `{ flowDef: ExecuteExpression[] }`.
- Update web-ide to send the new payload and web-server tests to match.

2) Expression evaluation
- Replace compileDSL usage with `compileExpression` from `depa-data-expression`.
- Build a scope object per execution that includes:
  - cell refs (A1/B2) mapped to prior results
  - db handles (wrapped via `makeDbHandle`) for connections (demo, etc.)
- Use `defaultMemberRegistry` for db member calls (query/execute/commit/rollback).

3) Database handle wiring
- Expose db handles through scope: `{ demo: makeDbHandle({ query, execute, commit, rollback }) }`.
- The query adapter should use the existing sqlite adapter or the server's executeQuery wrapper.

4) Flow execution order
- Preserve order from incoming `flowDef` list (same as current behavior).
- For each step:
  - evaluate expression against scope
  - store result in scope under its cell ref
  - if result is a query dataset, save it as the "last query" for response

5) Response shaping
- Always return steps array with per-cell status and values.
- Return `data` as the last query dataset if any; otherwise keep it undefined.

## Open Questions
- Whether to support the old `$q(...)` shorthand via a compatibility layer; propose to keep it via a small wrapper that rewrites `$q(...)` to `demo.query(...)` (or re-expose in spl-flow) if needed.
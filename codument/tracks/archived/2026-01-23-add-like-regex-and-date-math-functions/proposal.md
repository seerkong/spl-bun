# Change: Add Phase-2 expression functions and grouped Web-IDE demos

## Background

The TypeScript implementation of the expression engine already covers many core math/string/datetime functions, but the Phase-2 gap list still includes several commonly used functions:

- String: `like`, `regex`
- Math: `exp`, `ln`, `sign`, `gcd`, `lcm`
- Date: `age`, `workday`, `workdays`

In addition, the Web-IDE currently lacks demos that showcase these functions, which makes it harder for users to discover and validate the capabilities.

## Goals / Non-Goals

Goals:
- Add the missing built-in functions to `packages/expression`.
- Provide `regex` as both a builtin and a member function on strings.
- Implement `like` and workday/workdays semantics aligned with the Java engine where feasible.
- Add 3 grouped Web-IDE demos (string / math / date) to showcase the new functions.

Non-Goals:
- No Excel integration or chart rendering work in this track.
- No changes to the expression grammar to support Java-style `fn@opt(...)` syntax.
- No implementation of sequence/cursor regex operators beyond the scoped string+builtin `regex`.
- No new external dependencies unless required by existing project conventions.

## What Changes

Code changes are expected in:
- `packages/expression/src/functions.ts` (add built-in functions)
- `packages/expression/src/memberRegistry.ts` (add string member `regex`)
- `packages/expression/__tests__/expression.test.ts` (add tests for new functions)

Web-IDE demo changes are expected in:
- `packages/web-ide/src/pages/SplIde.vue` (add 3 grouped demos)

Documentation / tracking changes:
- `codument/tracks/add-like-regex-and-date-math-functions/*` (spec/proposal/design/plan)
- `codument/tracks.md` (append the new track entry)

## Impact

- Adds new function names; existing expressions should continue to work.
- `ln()` will be introduced as natural logarithm; it may be an alias of existing `log()` behavior.
- Date functions rely on JS `Date` behaviors (timezone/locale quirks) and may not perfectly match Java date parsing rules.

## Risks / Mitigations

- Risk: `Date` parsing and calendar logic differences vs Java.
  - Mitigation: define behavior in terms of Date components and add unit tests for edge cases.

- Risk: `regex()` return types and option parsing differences.
  - Mitigation: document exact return shapes and provide tests covering capture groups and replacement.

## Open Questions

- Should `regex()` overload resolution remain heuristic-based (3rd arg "looks like options") or be made arity-based to avoid ambiguity?
- Should date-oriented scenarios in spec.md use `datetime(...)` (timezone-stable) instead of `date("YYYY-MM-DD")`?

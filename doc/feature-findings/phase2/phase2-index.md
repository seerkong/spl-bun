# Phase 2: Enhanced Functionality (Index)

Source of Phase 2 list: `doc/brainstorm/port-expression-engine/act_4/engine-feature-diff.md`.

## Phase 2 items and current status

### 1) String operations: like, regex, split

- Java
  - Builtin `like`: `src/main/java/com/scudata/expression/FunctionLib.java` (see `addFunction("like", ...)`).
  - Member `regex`: `src/main/java/com/scudata/expression/FunctionLib.java` (see `addMemberFunction("regex", ...)`).
  - Member `split`: `src/main/java/com/scudata/expression/FunctionLib.java` (see `addMemberFunction("split", ...)`).
- TypeScript
  - Builtin `split` exists: `spl-bun/packages/expression/src/functions.ts`.
  - `like` missing (no builtin): `spl-bun/packages/expression/src/functions.ts`.
  - `regex` missing (no member fn): `spl-bun/packages/expression/src/memberRegistry.ts`.

Checklist
- [ ] Add builtin `like` (pattern matching semantics aligned with Java `Like`).
- [ ] Add member `regex` (confirm Java targets: string/sequence/op attach).
- [ ] Clarify whether TS should support both builtin + member variants for split/regex.

### 2) Math functions: exp, ln, sign, gcd, lcm

- Java
  - Registered in `src/main/java/com/scudata/expression/FunctionLib.java` (`exp/ln/sign/gcd/lcm`).
- TypeScript
  - Not present in `spl-bun/packages/expression/src/functions.ts`.

Checklist
- [ ] Add `exp`.
- [ ] Add `ln`.
- [ ] Add `sign`.
- [ ] Add `gcd`, `lcm`.

### 3) Date operations: age, workday

- Java
  - Registered in `src/main/java/com/scudata/expression/FunctionLib.java` (`age/workday/workdays`).
- TypeScript
  - Not present in `spl-bun/packages/expression/src/functions.ts`.

Checklist
- [ ] Add `age`.
- [ ] Add `workday`, `workdays` (confirm holidays/weekend rules in Java impl).

### 4) Set operations: union, diff, isect

- Java
  - Operator-level and member-level set ops exist (see `src/main/java/com/scudata/expression/Expression.java` and registrations in `src/main/java/com/scudata/expression/FunctionLib.java`).
- TypeScript
  - Operator-level set ops exist: `spl-bun/packages/expression/src/parser.ts`, `spl-bun/packages/expression/src/evaluator.ts`.
  - Named member function `isect` does not exist in TS.

Checklist
- [ ] Decide whether to add named functions/members (`union/diff/isect`) in TS in addition to operators.

### 5) Table operations: rename, alter, index

- Java
  - Member functions registered: `src/main/java/com/scudata/expression/FunctionLib.java` (`rename/alter/index`).
- TypeScript
  - Missing: `spl-bun/packages/expression/src/memberRegistry.ts`.

Checklist
- [ ] Define TS table model semantics for schema mutation (currently dataset-like `{ rows, schema, keys }`).
- [ ] Add `rename`.
- [ ] Add `alter`.
- [ ] Add `index`.


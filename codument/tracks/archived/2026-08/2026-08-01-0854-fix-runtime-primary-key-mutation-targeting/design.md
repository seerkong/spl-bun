# Design: Runtime Primary-Key Mutation Targeting

## Context

The public depa-orm Writer deliberately treats missing `where` as an unscoped
mutation. Domain bundle handlers do not own storage predicates; they supply a
complete current row with its public model primary key to the domain runtime.

## Design Overview

1. Keep `RuntimeMutation` unchanged.
2. Add one internal pure adapter that receives the compiled runtime model and a
   mutation.
3. For `create`, project entity/operation/values unchanged.
4. For `update` and `delete`, resolve the entity's actual compiled primary-key
   field, require a string or numeric value in `mutation.values`, and project
   `where: { [primaryKey]: value }`.
5. Reject unknown entity, missing primary key, or invalid key value before the
   public Writer is called. Never fall back to unscoped update/delete.

## Impact

- Runtime adapter only; no public contract change.
- Existing Writer, transaction, lifecycle, observation, and cleanup ownership
  remain unchanged.

## Decision Summary

- Storage targeting is runtime-owned, model-derived, and fail closed.
- No hard-coded `id`, private import, SQL, or generic bulk predicate is added.
- See `decisions.xnl`.

## Risks / Tradeoffs

- A regression could silently widen mutation scope. Multi-row sibling
  invariance and delete tests are mandatory.
- A single `id` fixture would produce false confidence. Tests include a
  non-`id` caller-supplied primary key.

## Compatibility

- `RuntimeMutation` consumers do not change shape.
- Create/seed, same-source atomic rollback, best-effort batch, package boundary,
  and G7 consumer behavior remain gates.

## Open Questions

- None. Mission QuestionSeverity is auto and the fresh AttractorCheck resolved
  the owner and minimum behavior.

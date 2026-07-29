# Change: Runtime Primary-Key Mutation Targeting

## Context And Why

The domain runtime accepts storage-neutral `RuntimeMutation` values and adapts
them to the public depa-orm Writer. Update/delete currently omit Writer
targeting, which turns a caller-intended keyed mutation into an unscoped table
mutation. Multi-row IT asset fixtures expose this as duplicate-primary-key
failure and, for delete, a latent full-table deletion risk.

## Goals / Non-Goals

Goals:

- Make runtime update/delete target exactly the row identified by the compiled
  entity primary key carried in mutation values.
- Reject missing, unknown, or invalid primary-key targeting before Writer IO.
- Cover multi-row, non-`id` key, update, delete, create, rollback, and host
  consumer compatibility.

Non-goals:

- Adding arbitrary caller-supplied `where` to `RuntimeMutation`.
- Changing depa-orm Writer or SQLite unscoped mutation semantics.
- Adding bundle-specific entity names or SQL/private imports.
- Expanding selection or bulk mutation behavior.

## What Changes

- Add runtime-owned RED tests for exact primary-key mutation targeting.
- Introduce an internal adapter from `RuntimeMutation` plus compiled model facts
  to public `WriteMutation`.
- Preserve create forwarding and public API shape.
- Run runtime and G7 consumer compatibility gates.

## Impact

- Behavior: `depa-orm-domain-runtime/operation-execution`.
- Code: `packages/depa-orm-domain-runtime/src`, runtime tests, G7 consumer tests.

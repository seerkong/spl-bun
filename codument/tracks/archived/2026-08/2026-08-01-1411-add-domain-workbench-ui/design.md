# Design: Domain Workbench UI

## Context

The server already exposes:

- `GET /api/domain-contexts`
- `GET /api/domain-contexts/:contextId`
- `GET /api/domain-contexts/:contextId/operations`
- `GET /api/domain-contexts/:contextId/presets`
- `POST /api/domain-operations/execute`

Reference bundles are registered only at production server startup. `createApp`
defaults to an empty registry for tests and embedded callers. The UI must
consume the live catalog projection and never infer hidden request state.

## Approach

1. Add a route-level workbench page.
   - Keep `/` mapped to the existing `KonIde`.
   - Add `/domain-workbench` mapped to a new dense operational page.
   - Use the existing Vite/Playwright webServer setup.
2. Fetch and project catalogs.
   - List contexts, then load the selected catalog.
   - Resolve parameterized routes with local encode-safe route builders instead
     of fetching route template strings containing `:contextId`.
   - Group `resources` by `kind`.
   - Filter operations by owner, behavior, subject, invocation, and effect.
   - Show `modelSources.content` in read-only panes.
3. Preserve exact request authority.
   - Selecting a preset copies `preset.request` into a JSON editor.
   - The editor text is the only submitted request body.
   - Use `depa-data-domain-operation-contracts` for DTO and parser authority;
     `web-shared` remains route/Kon-shared owner and does not duplicate Domain
     Operation DTOs.
   - Parse errors are local diagnostics; catalog mismatch is rendered from
     server response diagnostics.
4. Render execution response.
   - Outcome view renders all outcome variants as readable JSON/table/tree data.
   - Changes view renders atomicity, mutations, and batch item mapping.
   - Before/After view renders probe snapshots and diff.
   - Operation Tree view renders root and child refs.
   - Plan/SQL view renders public plan and SQL unavailable diagnostics honestly.
   - Batch views render `effects.batch.itemMapping` including unavailable
     mapping without inventing item outcomes.
   - Diagnostics view renders validation/capability/execution/cleanup issues.
5. Verify by browser behavior, not screenshots alone.
   - E2E covers default bundle load, preset preview exactness, a successful
     write, a partial batch preset, a business failure or catalog mismatch, and
     responsive layout at desktop/mobile widths.
   - E2E asserts the network body sent to execute and fails on unexpected
     console errors.

## Impact

- `packages/web-ide` gains a second operational surface and contract DTO
  dependency.
- `packages/web-shared` may gain small path builder helpers for parameterized
  routes; long-lived domain operation DTOs remain owned by
  `depa-data-domain-operation-contracts`.
- Server code should not change unless a missing route projection bug is found.

## Decisions

See `decisions.xnl`.

Current assumptions:

- The mission's active G8 node is treated as approval to create this track
  directly under `tracks/active` with `QuestionSeverity=auto`.
- v1 uses readable structured JSON/tree/table rendering for graph/tree/plan
  surfaces; custom graph visualization is not required for this track.
- Workbench request preview is a textarea-backed JSON editor unless an existing
  local editor dependency is already present.

## Risks And Mitigations

- **Request model drift**: mitigated by making editor text the submitted body
  and testing exact POST behavior.
- **UI overgrowth**: mitigated by dense panels, tabs, and existing design
  language rather than a landing page.
- **Diagnostic ambiguity**: mitigated by rendering HTTP 200 domain failures as
  response status plus diagnostics, not as fetch success.
- **Mobile overlap**: mitigated by responsive CSS and Playwright viewport tests.
- **Route-template misuse**: mitigated by local route builders and tests that
  load real catalogs by encoded context id.

## Pending Questions

- None blocking. If graph visualization becomes important later, create a
  follow-up track for richer visual components.

## Planning Attractor Result

Fresh planning review returned `PLAN_ATTRACTOR_PASS`. It raised no P0 blocker
and requested explicit coverage for contract dependency ownership, route
builders, unavailable response facts, network body assertions, console checks,
and mobile viewport validation. Those constraints are now included in this
track.

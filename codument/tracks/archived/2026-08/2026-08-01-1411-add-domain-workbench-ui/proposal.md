# 变更：Domain Workbench UI

## 背景和动机 (Context And Why)

The mission has completed the transport-neutral Operation contracts, runtime,
server API, and two executable reference DomainContext bundles. The remaining
product loop is a real workbench in `packages/web-ide`: users need to inspect
registered bundles, choose operation presets, preview the exact request JSON,
execute it, and observe relational effects without writing code or touching
database internals.

## "要做"和"不做" (Goals / Non-Goals)

**目标:**
- Add a `/domain-workbench` route that coexists with the existing Kon IDE route.
- Load live domain-context catalogs from the web-server API.
- Show read-only model sources, semantic resources, operation filters, presets,
  and an editable exact `ExecuteOperationRequest` preview.
- Execute the preview JSON unchanged and render outcome, changes, before/after,
  operation tree, plan/SQL availability, and diagnostics.
- Cover success, partial batch, business failure/catalog mismatch, and
  responsive layout through tests and Playwright E2E.

**非目标:**
- No online Kon editing/recompile in v1.
- No arbitrary code upload, runtime binding injection, or direct database edit.
- No persistent execution state; every execution remains server/runtime owned.
- No new server contract shape beyond the existing Domain Operation endpoints.

## 变更内容（What Changes）

- Add workbench UI components and route under `packages/web-ide`.
- Add minimal domain-operation client helpers using public `depa-data-web-shared`
  routes and import Domain Operation DTO/parser types from
  `depa-data-domain-operation-contracts` rather than re-owning them in
  `web-shared`.
- Extend E2E helpers/tests for `/domain-workbench`.
- Keep the existing `/` Kon IDE behavior and E2E tests green.
- Promote `domain-workbench-ui` behavior on archive.

## 影响范围（Impact）

- 受影响的能力（behaviors）：`domain-workbench-ui`
- 受影响的代码：
  - `packages/web-ide/src/router/index.ts`
  - `packages/web-ide/src/pages/**`
  - `packages/web-ide/src/components/**`
  - `packages/web-ide/__tests__/e2e/**`
  - `packages/web-ide/package.json`
  - `packages/web-shared/src/index.ts` if route/helper projection needs a
    small public convenience helper
  - `playwright.config.ts` if explicit mobile project coverage is cleaner than
    per-test viewport control

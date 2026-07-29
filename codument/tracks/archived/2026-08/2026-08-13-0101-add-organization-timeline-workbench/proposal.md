# Track: Organization Timeline Workbench

## Summary

Promote `organization-adjustment` into the production reference composition, preserve every timeline fact through the explicit web-server catalog projection, and add day-level timeline controls to the existing Domain Workbench without creating a second request model.

## Problem

G3 exports a complete temporal organization bundle, but production composition still registers only the event and commerce contexts. The server's explicit public DTO projection also predates the timeline contract: it omits both `OperationDefinition.timeline` and `OperationPresetDto.request.timeline`. Registering the organization bundle without correcting that projection would publish presets that no longer match their catalog and cannot execute unchanged.

The Workbench already treats its JSON editor as the sole request authority, but it has no direct day control. Users must edit timeline JSON manually even though as-of, effective-on, and range are first-class request facts.

## Scope

- Extend explicit server projections to clone optional operation timeline capabilities and complete request timeline values without leaking authoring/runtime internals.
- Add `organization-adjustment` as the third production reference bundle while preserving empty-by-default `createApp` injection.
- Execute every organization preset through the existing catalog and execute routes, with exact fetched request/POST parity, stable statuses, and fresh sequential/concurrent behavior.
- Add mode-specific day inputs derived only from a currently valid editor request; edits replace `request.timeline` in that same JSON text.
- Keep invalid JSON/schema/catalog text unchanged and make timeline controls unavailable until the editor becomes valid again.
- Verify snapshot, apply, business failure, partial batch, response observations, and responsive desktop/mobile workflows.

## Non-Goals

- No new transport route, request DTO, timeline store, browser-side domain model, auth system, or persistent database.
- No Kon source editing or recompilation.
- No changes to temporal organization validation, workflow, Writer authority, or runtime transaction semantics.
- No sub-day controls and no timezone conversion UI.

## Success Criteria

1. Public server catalogs preserve timeline capabilities and every preset request exactly enough to parse, catalog-match, and POST unchanged.
2. Production startup lists all three reference contexts; injected `createApp()` with no registrations remains empty.
3. All organization presets produce the same stable execution facts directly and through HTTP, including failure and partial outcomes.
4. Workbench controls project as-of, effective-on, and range days from the valid editor request and update only the same JSON text.
5. Invalid editor content is never repaired or replaced by controls, and execution remains unavailable.
6. Browser network capture proves the edited JSON is the exact POST body and that the response uses the edited date.
7. Desktop/mobile controls remain bounded without overlap; existing Kon IDE and reference-bundle regressions remain green.

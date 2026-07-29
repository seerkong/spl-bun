# Design: Organization Timeline Workbench

## Authority Flow

```text
DomainContextBundle catalog
  -> explicit server DTO projection
  -> GET catalog/presets
  -> preset.request JSON editor text
  -> schema + catalog validation
  -> derived timeline controls
  -> immutable request.timeline edit
  -> replacement JSON editor text
  -> POST exact current editor text
  -> unchanged runtime response envelope
```

The editor text remains the only browser request authority. `selectedPresetKey` selects an initial request but does not own a parallel payload. Timeline controls have no mutable date state: their values are computed from `requestValidation.ok === true ? request.timeline : null` and each input event parses the current valid request, clones the request plus timeline branch, and serializes it back to the editor.

## Server Projection

The server continues to enumerate public fields explicitly. Add closed helpers for:

- `OperationTimelineCapabilitiesDto`: clone `granularity`, `modes`, and `required`.
- `OperationTimelineContext`: switch on `mode` and clone only the corresponding day fields plus optional `recordedAt`.

`projectOperation` emits optional `timeline`; `projectExecuteRequest` emits optional `timeline`. Non-temporal values remain byte-semantically equivalent after JSON serialization, and no generic spread is introduced across the catalog/runtime boundary.

## Production Composition

`referenceBundleIds`, `referenceBundles`, and `referenceBundleRegistrations` become one ordered three-entry authority:

1. `event-operations-lifecycle`
2. `commerce-operations`
3. `organization-adjustment`

The organization registration reuses its exported immutable bundle and server capabilities. `createApp({ domainContexts: [] })` remains the injection default; only `import.meta.main` production startup imports the reference composition.

## HTTP Verification

The server integration test fetches each projected catalog, checks parser and catalog parity for every preset, and POSTs the exact fetched `preset.request`. Direct runtime and HTTP responses are compared after removing execution-specific ids/timing. Organization write failures and partial batch outcomes retain their stable expected statuses; snapshot/apply representatives also prove sequential and concurrent fresh seeds.

## Timeline Editor API

`domainWorkbenchRequest.ts` owns a small pure edit function:

```ts
updateTimelineDay(
  editorText,
  catalog,
  field: "asOf" | "effectiveOn" | "from" | "to",
  value,
): { ok: true; editorText: string } | { ok: false; issues: readonly LocalRequestIssue[] }
```

It first runs the existing exact JSON/schema/catalog validation. It rejects a field not owned by the current timeline mode. It never mutates the parsed request, catalog, preset, or the original text on failure. On success it returns pretty-printed JSON containing the edited complete request. The normal computed validator immediately revalidates date/calendar/range rules.

## UI Composition

The timeline strip is an unframed full-width band adjacent to the request heading. It renders:

- mode and day granularity as read-only facts;
- one date input for `as-of`;
- one date input for `effective-on`;
- `from` and `to` date inputs for `range`;
- optional recorded-time fact when present, without timezone conversion.

There is no mode selector because the operation definition and selected preset own the supported request shape. Selecting another preset changes mode through the same complete request authority. Invalid editor state shows the existing diagnostics and no interactive timeline inputs.

## Error And Response Behavior

- Local JSON/schema/catalog invalidity disables execution and leaves editor text untouched.
- Domain business failures remain HTTP 200 response envelopes and render through existing Outcome/Changes/Before/After/Trace/Plan/Diagnostics views.
- Snapshot trees expose the edited as-of date in their root label/facts.
- Apply success, atomic failure, and best-effort partial retain truthful mutation, probe, plan, and diagnostic facts.

## Boundary And Verification

- Bundle package still imports no server code.
- Server and UI use only package public roots.
- Existing event/commerce and Kon IDE behavior remains unchanged except that production context count becomes three.
- Unit tests cover all timeline edit modes and invalidity; server tests cover complete temporal projection and HTTP parity; Playwright captures exact POST JSON and checks desktop/mobile bounding boxes and console errors.

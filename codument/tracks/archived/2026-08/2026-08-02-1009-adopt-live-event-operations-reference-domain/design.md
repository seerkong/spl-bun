# Design

## Boundary

This track replaces reference-domain facts inside `depa-data-domain-context-bundles` and its integration tests. The existing contract/runtime/server composition remains authoritative. No handler may bypass the public runtime context or add hidden state.

## Domain Identity

| Fact | Target |
| --- | --- |
| Bundle id | `event-operations-lifecycle` |
| Bundle version | `event-operations-lifecycle@1` |
| Title | `Live event operations` |
| Operation namespace | `EventOps` |
| Model source | `model://event-operations-lifecycle/reference` |

## Relational Model

| Entity | Purpose | Important fields |
| --- | --- | --- |
| `EventProduction` | live event aggregate | `id`, `eventCode`, `readinessState`, `lifecycleState` |
| `CancellationCase` | cancel-event work item | `id`, `eventId`, `attendeesNotified`, `status`, `venueBookingId` |
| `ServiceContract` | event service agreement | `id`, `name` |
| `EventCoveredByContract` | explicit association row | `id`, `eventId`, `contractId` |
| `PublicationNotice` | lifecycle transition subject | `id`, `eventId`, `progressState` |
| `VenueBooking` | constraint authority | `id`, `status` |
| `RefundLine` | settlement process subject | `id`, `eventId`, `status` |
| `ArchiveRequest` | extension Action subject | `id`, `eventId`, `status` |

## Frozen Operation Matrix

| # | Operation ref | Owner | Behavior | Subject | Invocation | Effect |
| ---: | --- | --- | --- | --- | --- | --- |
| 1 | `EventOps.EventProduction.Get` | business-object | query | single | single | read-only |
| 2 | `EventOps.CancellationCase.CancelEvent` | business-object | action | single | single | mixed |
| 3 | `EventOps.CancellationCase.QueryAssociatedEvent` | business-object | query | single | single | read-only |
| 4 | `EventOps.CancellationCase.ValidateAttendeesNotified` | business-object | validate | single | single | read-only |
| 5 | `EventOps.CancellationCase.MarkCanceled` | business-object | mutation | single | single | write |
| 6 | `EventOps.EventProduction.ReleaseEventSlot` | business-object | mutation | single | single | write |
| 7 | `EventOps.EventCoveredByContract.Link` | association | mutation | single | single | write |
| 8 | `EventOps.PublicationProgress.Advance` | lifecycle | transition | single | single | write |
| 9 | `EventOps.VenueBookingMustExist.Validate` | constraint | validate | single | single | read-only |
| 10 | `EventOps.RefundLine.MarkSettled` | business-object | mutation | single | single | write |
| 11 | `EventOps.RefundSettlement.Execute` | business-process | composed | single | single | mixed |
| 12 | `EventOps.ArchiveRequest.CloseAndArchive` | business-object | action | single | single | mixed |

## CancelEvent Composition

`CancelEvent` invokes these registered definitions in order:

1. `QueryAssociatedEvent`
2. `ValidateAttendeesNotified`
3. `MarkCanceled`
4. `ReleaseEventSlot`

The success seed has `attendeesNotified=true`; both case and event writes commit. The failure seed has `attendeesNotified=false`; the visible query/validation prefix remains in the operation tree, no writes commit, and execution diagnostics identify the failure.

## Other Semantic Operations

- Association: link an `EventProduction` and `ServiceContract` through an explicit `EventCoveredByContract` entity.
- Lifecycle: advance `PublicationNotice.progressState` only when its event is in the required scheduled state.
- Constraint: return a structured `{ valid }` outcome based on the referenced `VenueBooking` row; absence is a business violation, not an execution exception.
- BusinessProcess: `RefundSettlement.Execute` invokes the independently registered `RefundLine.MarkSettled` child.
- Extension Action: `ArchiveRequest.CloseAndArchive` updates both the request and event and exposes both through probes.

## Migration Policy

Current product source, tests, bundle identifiers and promoted behavior target state move completely to EventOps. Historical Codument archives stay immutable and may retain the earlier vocabulary as evidence of the replaced implementation.

## Risks And Controls

- Identifier drift: contract tests enumerate all 12 refs and assert preset/catalog parity.
- Semantic shrinkage: matrix tests retain success/failure/tree/mutation/probe/diff assertions, not merely renamed snapshots.
- Browser race: existing authoritative preset/editor readiness checks remain intact.
- Accidental broad rewrite: scans exclude archives and the protected capsule; Commerce assertions are explicitly rerun.

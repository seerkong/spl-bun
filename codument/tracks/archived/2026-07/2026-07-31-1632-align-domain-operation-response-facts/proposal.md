# Proposal: Align Domain Operation Response Facts

## Why

The runtime P3 coding AttractorCheck proved that the current response type
cannot truthfully represent an exact-request parse failure. It requires a
context, operation ref, requested atomicity and operation-tree root even when
none of those facts were admitted. Runtime consequently substitutes bundle
identity, an empty ref and atomic execution.

The shared transport-neutral contract owns these envelope semantics. Replacing
one runtime default with another would preserve the defect at a different
value.

## Goal

Make request-derived and execution-derived response facts explicitly
unavailable when they were not established, while preserving complete facts
for valid requests and all existing outcome/effects/observations/diagnostics
behavior.

## Scope

- Allow `null` for unavailable response context, operation ref, requested
  atomicity and operation tree.
- Add a public pure helper that projects independently valid request facts from
  unknown input without claiming full request validity.
- Cover full, partial and absent fact projection, failure response JSON
  roundtrip, existing success responses, package build and root build.
- Update the complete `execute-response` behavior requirement.

## Non-Goals

- Runtime transaction or observation fixes.
- Server routes, HTTP status policy, UI rendering or reference bundles.
- Request parser relaxation or partial execution of malformed requests.
- Changes to depa-orm or `packages/depa-orm-capsule`.

## Compatibility

This is a deliberate pre-release type widening: existing successful response
fixtures remain valid, while consumers must handle `null` on failure paths.
The API version stays `1`; the response envelope version is still known even
when request-derived facts are unavailable.

## Success Criteria

1. Full valid requests project all facts unchanged.
2. Independently valid facts survive a different request validation error.
3. Input with no valid context/ref/atomicity projects all three as `null`.
4. Failure response fixtures use `null` rather than sentinel strings or hidden
   defaults, including a null operation tree before admission.
5. Existing contract tests, declaration build and root build pass without
   runtime, database, transport or capsule dependencies entering the package.

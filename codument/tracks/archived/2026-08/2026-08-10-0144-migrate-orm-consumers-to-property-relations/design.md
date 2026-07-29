# Design: property-first consumer migration

## Context

The upstream language and ORM tracks are complete. This track consumes their public build contract and removes the host's remaining detached authoring authority. Runtime schemas remain projections; they are not renamed merely because their source changes.

## Solution Overview

1. Freeze a semantic migration oracle.
   - Inventory each old owner relation by source class, property names, target class, cardinality, endpoint tuples, through topology and runtime options.
   - Normalize volatile identity differences so before/after comparisons focus on behavior; any intentional edge-key change is asserted explicitly.
2. Rebase package consumption.
   - Committed imports use only package exports, primarily `depa-orm-dsl-kon` root.
   - Local verification may use `bun link` or packed artifacts from sibling projects, but manifests, tsconfig and source never contain absolute paths.
3. Migrate source fixtures by model graph.
   - Normalize old Field annotation lists into typed Field object profiles before relation projection; preserve field kind, storage, index, description and validation through the legacy entity-schema oracle.
   - Add one typed owner Property to the owning class.
   - Add an inverse Property to the target class only when a visible reverse navigation exists; otherwise rely on the hidden internal reverse.
   - Preserve ordered tuple keys and all admitted owner-side and inverse-side runtime options.
   - Remove the entire `:relationships=` section and detached relation node after its facts are represented on Properties.
4. Migrate programmatic consumers.
   - Construct real Kunun `ClassDefinition` values with `RowMemberBuilder.Field` and `RowMemberBuilder.Property`.
   - Attach profiles through `OrmKununMetadata`; compile with `OrmKununDefinitionCompiler`.
   - Replace snapshot/diff helpers with direct catalog normalization owned by host tests.
5. Close drift paths.
   - Update copied canonical docs.
   - Extend architecture guards across fixtures, helpers, production consumers and docs.
   - Keep explicit negative tests for retired source forms, but isolate literal markers in allowlisted guard fixtures so searches distinguish tests from canonical authoring.

## Impact

- Fixture sources and relation contract tests change broadly but retain runtime assertions.
- Helper imports move to the DSL package public root.
- Domain runtime keeps its existing adapter boundary and is rebuilt against the new compiler output.

## Decisions

- The existing runtime behavior is the migration oracle; source spelling is intentionally breaking.
- Visible reciprocal navigation requires a real inverse Property. A generated hidden reverse is not a substitute for a public domain member.
- No compatibility reader is introduced because the entire controlled fixture corpus migrates in one track.
- Package publication is deferred; verification links are ephemeral and documented in reports.

## Risks And Controls

- Bulk edits can swap tuple direction or collection shape. Control: structured inventory plus focused cardinality/composite/through tests before the full suite.
- Field-profile admission can fail before relation projection. Control: migrate only the affected bundle Fields and compare normalized legacy/current entity schemas.
- Legacy compiler output uses caller-selected edge keys while the new authority uses owner FQ identity. Control: normalize edge identity in the oracle and update tests to assert the new stable rule.
- Deep imports may survive outside relation tests. Control: repository-wide import guard and TypeScript build using package export maps.
- Explicit inverse insertion can create duplicate owners. Control: compile fixtures in bundle scope and require zero property diagnostics.

## Migration Plan

1. Establish public artifact resolution and an inventory/oracle while old fixtures still compile.
2. Migrate representative direct, inverse, composite and through fixtures and freeze helpers.
3. Migrate the remaining fixture graph and programmatic tests.
4. Update docs and guards, then run full capsule and workspace integration gates.

## Open Questions

- None. Any uncovered upstream capability gap reopens the mission control loop rather than adding a host compatibility authority.

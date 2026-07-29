# Mission: canonicalize ORM annotation NamedConf

## Background

The completed `restore-property-first-orm-modeling` mission restored Kunun typed navigation properties as the only relationship-authoring authority. A remaining transport drift still exists across Kunun, depa ORM, and spl-bun: ORM annotations encode their profile kind in the annotation knot name, for example `#(orm #field :{ ... })`, while Kunun already provides `KnKnot.NamedConf` for named configuration carried by an annotation.

The drift is broader than syntax. Field metadata still has a nested `storage` envelope, datasource declarations can be projected from either an ORM annotation or direct datasource `Conf`, and positive fixtures, current documentation, generated artifacts, and application bundles still teach the old forms. Keeping both paths would preserve competing authorities and allow later code-first/source-first drift.

## Goal

Establish one hard-cut ORM modeling contract across the three projects:

- ORM remains a prefix annotation attached to the modeled Kunun declaration.
- `KnKnot.NamedConf` is the sole source transport for the `datasource`, `entity`, `field`, and `relation` ORM profiles.
- The Kunun public type-system model remains the sole semantic authority for source-first and programmatic code-first modeling.
- Relationship metadata remains exclusively attached to typed navigation properties.
- Field metadata is flat and limited to scalar/column persistence, index, and validation concerns.
- Datasource declaration identity and ORM runtime configuration have separate, single authorities.
- All live producers and consumers migrate atomically, with no compatibility reader, fallback, or dual emission.
- Release candidates are built, tested, packed, and publish-dry-run verified without publishing them.

## Non-Goals

- Do not change the established property-first relationship semantics, cardinality model, tuple model, or runtime query/write behavior except where required to remove an old transport authority.
- Do not introduce a new detached `EntityModel`, `RelationModel`, relation primitive, or ORM-specific shadow type system.
- Do not place relationship metadata on foreign-key fields such as `shopId`, `orderId`, or composite tuple members.
- Do not publish Kunun or depa ORM packages to a registry as part of this mission.
- Do not rewrite immutable Codument archive history merely to remove historical syntax examples.
- Do not treat explicit negative fixtures as canonical examples.

## Success Criteria

1. The only canonical source forms are `#(orm :datasource = {...})`, `#(orm :entity = {...})`, `#(orm :field = {...})`, and `#(orm :relation = {...})`, each attached to its valid target declaration.
2. Kunun parses the profile payload from `KnKnot.NamedConf`; the old marker-name-plus-`Conf` transport is rejected with stable diagnostics.
3. Source-first and programmatic code-first inputs converge on the same Kunun public type-system model and produce equivalent metadata, diagnostics, and compiled ORM catalogs.
4. A relation profile can decorate only a typed navigation Property. Its owner exclusively controls ordered join tuples, through topology, physical join mapping, and write authority; an inverse Property only references the stable owner Property identity.
5. Field profiles have no `storage` envelope and cannot contain relation metadata. Programmatic `OrmKununMetadata.field(...)` uses the same flat shape.
6. `(datasource #main)` makes `main` the sole datasource identity. `orm :datasource` exclusively owns provider, environment connection reference, and options. Annotation `key`/`name`, direct datasource `Conf`, missing ORM datasource configuration, and old fallback paths are rejected.
7. Production source, positive fixtures, current docs, application bundles, generated declarations/JavaScript, and packed tarballs contain no old ORM annotation transport and no live compatibility reader. Only explicit negative tests and immutable Codument archives may contain old syntax.
8. Kunun changes are included in the already-unreleased `1.0.4` package set. Affected public depa ORM packages receive the SemVer breaking bump determined from their current `0.1.x` line and dependency graph; spl-bun consumes the resulting package contract.
9. Project-owned test, typecheck, build, pack, package-content, and publish-dry-run gates pass. No actual publish command succeeds or is attempted.
10. Fresh cross-project verification covers source-first and code-first paths, scalar and composite relations, owner/inverse, one/many, through topology, read/write behavior, datasource admission, and the complete Kunun-model-to-runtime projection.

## Why This Is A Mission

The change crosses a language/type-system package family, an ORM compiler/runtime package family, and an application/test workspace. The lower-level contracts must land before consumers can migrate, while final acceptance must inspect generated and packed artifacts across all three projects. A mission is required to control the dependency DAG, observe drift, replan from evidence, and coordinate multiple real tracks.

The mission is the control plane only. Source, tests, specifications, versions, and migration work are implemented by real tracks in their owning projects.

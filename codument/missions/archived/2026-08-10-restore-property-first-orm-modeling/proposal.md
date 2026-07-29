# Mission: restore property-first ORM modeling

## Background And Motivation

The current depa ORM Kon authoring model has drifted away from the required class model. Kunun classes distinguish persisted fields from properties, but depa ORM currently asks authors and code-first consumers to declare relations in a separate `:relationships=` section through `(relation ...)` nodes. The compiler then uses `property_key` to project that detached relation descriptor back onto an object-facing property.

That order is inverted. A domain relation is authored as a typed navigation property such as `Order.shop`, `Shop.orders`, or `Department.employees`. A persisted field such as `shopId` is only one storage participant and cannot own the relation. This distinction is required for composite joins: a navigation property may map ordered tuples of multiple fields without turning any one field into the semantic relation authority.

The drift spans three projects:

- Kunun provides the class/type-system authority and already distinguishes runtime `field` and `prop`, but its static type-system representation must be audited and completed for typed navigation properties and code-first construction.
- depa ORM currently owns a shadow code-first entity/relation model, reads relation primitives from `:relationships=`, and compiles them into runtime relation schemas.
- spl-bun owns the active depa ORM test capsule, DSL documentation copies, fixtures, and consumer/workbench verification that currently reinforce the detached relation syntax.

## Goals

- Make the Kunun type system the semantic and programmatic authority for code-first class DSL modeling.
- Represent domain relations on typed navigation properties, distinct from persisted fields.
- Attach ORM relation metadata to navigation properties, including owning/inverse role, cardinality, target type, ordered composite field tuples, through topology, constraints, load strategy, and write policy where applicable.
- Remove independent relation primitives and `:relationships=` as canonical authoring inputs.
- Keep compiled `OrmRelationSchema` and runtime relation indexes only as derived, rebuildable projections of property metadata.
- Make the depa ORM code-first API a thin adapter over Kunun type-system models instead of a second entity/relation modeling authority.
- Migrate spl-bun documentation, fixtures, tests, and consumers to the property-first model and add guards that reject renewed field-owned or detached relation authoring.
- Preserve relation read/write behavior, composite-key support, storage validation, and public runtime semantics while changing the modeling source.

## Non-Goals

- A persisted field such as `shopId` will not become a relation declaration site.
- The mission will not infer semantic relations merely from database foreign-key metadata.
- The mission will not keep property metadata and detached relation declarations as two long-lived writable authorities.
- The mission will not redesign query selection, relation loading, cascade behavior, or SQL execution except where adaptation is required to consume the new compiled projection.
- The mission will not add domain-specific names or special cases to Kunun or depa ORM.
- The mission control plane will not directly replace the implementation tracks. Code, specifications, migrations, and tests are delivered by real tracks in their owning projects.

## Success Criteria

1. Kunun exposes a typed class navigation-property model usable by source parsing and programmatic code-first construction; fields and navigation properties remain distinct in its public type-system contract.
2. A canonical class can express `Order.shop: Shop`, `Shop.orders: Order[]`, and equivalent navigation properties without declaring an independent relation primitive.
3. ORM metadata on an owning navigation property can map ordered composite tuples such as `Order.(tenantId, shopId)` to `Shop.(tenantId, id)`; tuple arity, order, field existence, and type compatibility are validated.
4. An inverse navigation property references its owning property without duplicating physical join/storage authority.
5. depa ORM compiles navigation-property metadata into the existing runtime relation contract and derives any reciprocal runtime projection without accepting fields or detached relation nodes as canonical relation sources.
6. The depa ORM code-first API constructs or decorates Kunun type-system class/property models and does not retain an independent `RelationModel` authority.
7. Canonical authoring no longer emits `:relationships=` or `(relation ...)`; unsupported legacy sources fail with explicit migration diagnostics unless a bounded migration reader is temporarily required by a track and has a tested removal gate.
8. All relevant depa ORM unit, contract, relation read/write, composite-key, package-boundary, typecheck, and build tests pass.
9. All spl-bun depa-orm-capsule fixtures and consumers use property-first relation declarations; repository guards prevent canonical docs or fixtures from returning to detached relation syntax.
10. Fresh independent verification traces representative single-field, composite-field, owning/inverse, one/many, through, read, and write cases from Kunun property source through depa ORM compilation and runtime behavior.

## Why This Is A Mission

This is a modeling-authority correction rather than a syntax-only refactor. It crosses the Kunun language/type-system contract, depa ORM compiler and code-first boundaries, and spl-bun's active fixture and consumer surface. The dependency order matters: consumers cannot migrate until the language model and compiler projection are stable, while feedback from real relation fixtures may reveal missing type-system or compiler invariants.

The mission owns the desired-state DAG, cross-project observation, drift detection, and controlled replanning. Real tracks own the implementation:

| Track | Owning project | Responsibility |
| --- | --- | --- |
| `add-typed-navigation-property-model` | Kunun language | Typed navigation-property contract and code-first type-system API |
| `replace-orm-relation-dsl-with-property-metadata` | depa ORM | Property metadata profile, compiler projection, code-first adoption, legacy rejection |
| `migrate-orm-consumers-to-property-relations` | spl-bun | Documentation, fixtures, consumer tests, workbench examples, regression guards |

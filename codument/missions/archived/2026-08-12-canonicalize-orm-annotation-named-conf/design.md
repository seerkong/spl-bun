# Mission Design: canonicalize ORM annotation NamedConf

## Control Objective

- **Desired state**: the invariants and canonical syntax in this design, accepted decisions in `decisions.xnl`, success criteria in `proposal.md`, and the DAG/state in `mission.xml`.
- **Actual state**: Kunun parser/type-system/annotation packages, depa ORM profiles/compiler/runtime packages, spl-bun fixtures/docs/application bundles, generated artifacts, packed tarballs, package versions, real track state, and fresh verification evidence.
- **Actuation**: create, execute, verify, and archive real tracks in the owning projects; update package versions and consumers through those tracks; revise this mission only from evidence or an explicit human decision.
- **Feedback and drift**: parser and profile diagnostics, structural-equivalence tests, composite relation suites, datasource admission tests, runtime read/write suites, residue scans, build outputs, pack manifests, publish dry runs, and independent cross-project audits.

Standard actor semantics are defined by the Mission XML specification. This mission's project-specific actor ownership is materialized in `mission.xml`.

## Fixed Vocabulary

### Prefix annotation

`#(orm ...)` is an annotation knot placed immediately before and attached to a Kunun declaration. ORM configuration must not be embedded inside the target class, field, property, or datasource body as an internal `orm` member.

### NamedConf

`KnKnot.NamedConf` is only the transport that names an ORM profile payload, such as `field` or `relation`. It is not a second model and does not own entity, field, property, or relation semantics.

### Semantic authority

The Kunun public type-system class model is the semantic authority. Kon source and programmatic code-first construction must converge on that same model before depa ORM projection.

### Typed navigation Property

A Property whose Kunun type identifies a target class or collection. It owns semantic navigation such as `Order.shop`, `Shop.orders`, and `Department.employees`. A scalar Field such as `shopId` may participate in storage mapping but never owns the relationship.

## Canonical Attachment Contract

| NamedConf profile | Required target | Owns |
| --- | --- | --- |
| `datasource` | `(datasource #name)` declaration | ORM provider, environment connection reference, driver options |
| `entity` | `(class #Type ...)` declaration | Entity/table mapping, datasource reference, primary-key policy |
| `field` | `field` member | Scalar/column persistence, index, validation |
| `relation` | typed `prop` member | Relationship role, ordered join tuples, through topology, loading/write policy |

Any profile attached to a different target kind is invalid. In particular, `:relation` on a Field and `:field` on a Property must fail closed.

## Canonical Source Examples

### Datasource

```kon
#(orm :datasource = {
  kind = sqlite
  env_conn = DATABASE_URL
  options = {
    pool = 10
  }
})
(datasource #main)
```

`#main` is the only datasource identity. The annotation does not repeat `key` or `name`. A human-facing label is outside this mission and must not be smuggled into identity fields.

### Entity and flat Fields

```kon
#(orm :entity = {
  primary_key = [id]
  datasource = main
  db = { tableName = commerce_order }
})
(class #Order :[
  #(orm :field = {
    column_name = id
    declared_type = TEXT
    nullable = false
  })
  (!String field #id)

  #(orm :field = {
    column_name = shop_id
    declared_type = TEXT
    nullable = false
    index = true
  })
  (!String field #shopId)
])
```

The Field profile is flat. `column_name`, `declared_type`, `nullable`, scalar persistence options, `index`, and `validation` may be present directly under `:field`; a nested `storage = {...}` layer is forbidden.

### Owning and inverse Properties

```kon
#(orm :relation = {
  role = owner
  cardinality = many_to_one
  optional = false
  from = {
    keys = [tenantId shopId]
    has_foreign_key = true
  }
  to = {
    keys = [tenantId id]
    has_foreign_key = false
  }
  inverse_property = Shop.orders
})
(!Shop prop #shop)

#(orm :relation = {
  role = inverse
  inverse_of = Order.shop
})
(!Order[] prop #orders)
```

The scalar Fields named in `keys` remain Fields. The relationship itself belongs to the typed Property. Composite tuples are ordered and are validated as one mapping, so the design does not depend on a single foreign-key Field.

## Programmatic Code-First Contract

The programmatic API decorates Kunun type-system objects and uses the same profile shapes as source-first input:

```ts
OrmKununMetadata.field({
  column_name: "shop_id",
  declared_type: "TEXT",
  nullable: false,
  index: true,
});

OrmKununMetadata.relation({
  role: "owner",
  cardinality: "many_to_one",
  from: { keys: ["tenantId", "shopId"], has_foreign_key: true },
  to: { keys: ["tenantId", "id"], has_foreign_key: false },
  inverse_property: "Shop.orders",
});
```

`OrmKununMetadata.field(...)` has no `storage` property. `OrmKununMetadata.relation(...)` remains a programmatic adapter only when applied to a typed Kunun Property; it must not construct or retain a detached relation model.

The convergence pipeline is one-way:

```text
Kon prefix annotation + NamedConf -> Kunun public type-system model --\
                                                                  -> depa ORM projection -> runtime schema
Programmatic Kunun class + metadata ------------------------------/
```

### Annotation retention boundary

Kunun `1.0.4` retains Field and Property source annotations on bound `RowMember` metadata, so depa ORM reads those profiles from the bound public type model. Kunun does not retain a class declaration's prefix annotation on `ClassDefinition`; datasource declarations also do not enter `KonTypeBinder`. For those two targets only, depa ORM may pass the raw declaration to Kunun's public `AdmitOrmNamedConf` to extract the entity or datasource payload.

This is a transport exception, not a structural authority exception: class members, member kinds, types, inheritance, Property targets, and relation topology still come only from the bound Kunun `ClassDefinition`/`RowMember` model. Raw class/datasource declarations may supply annotation payload and source location, but may never supply a member graph, relation endpoint, detached relation, or fallback configuration. Programmatic entity profiles converge with the extracted source entity payload at the depa-owned normalized `OrmEntityProfile` consumed together with the same Kunun class model.

Parser, profile, composer, adapter, compiler, and runtime code must not create a shadow `EntityModel` or `RelationModel`. Runtime schemas are derived projections and must never write back into the authoring model.

## Relationship Authority Invariants

1. Property type is the authority for relation target and single-versus-collection shape; metadata may refine but may not contradict it.
2. The owning Property exclusively owns ordered local/target tuples, through segments, physical join mapping, and relation write authority.
3. The inverse Property only references the stable fully qualified owner Property identity and cannot repeat storage or through mapping.
4. Tuple arity, order, endpoint Field existence, Field-versus-Property kind, storage compatibility, nullability, and every through segment are validated explicitly.
5. Fields may be tuple participants but cannot carry relation role, cardinality, inverse, through, cascade/write, or join metadata.
6. Independent ORM relation primitives and detached relation sections remain forbidden.

## Datasource Authority Invariants

The datasource declaration and annotation are complementary, not interchangeable:

| Concern | Sole authority |
| --- | --- |
| Stable identity/reference | declaration name, for example `#main` |
| Provider kind | `orm :datasource.kind` |
| Environment connection reference | `orm :datasource.env_conn` or its canonical typed equivalent |
| Driver/runtime options | `orm :datasource.options` |

The compiler must reject:

- direct configuration such as `(datasource #main :{ ... })`;
- old `#(orm #datasource :{ ... })` transport;
- annotation `key` or `name` identity duplication;
- a datasource used by ORM without a valid `orm :datasource` profile;
- simultaneous or mergeable datasource configuration paths.

The current annotation-first/direct-Conf-fallback projection must be removed rather than retained behind a deprecated branch.

## Forbidden Live Forms

```kon
#(orm #datasource :{ ... })
#(orm #entity :{ ... })
#(orm #field :{ storage = { ... } })
#(orm #relation :{ ... })
(datasource #main :{ ... })
```

Also forbidden are ORM configuration embedded inside target-node `Conf`/`NamedConf`, relation annotations attached to Fields, independent ORM relation declarations, dual emission, permissive fallback, and automatic conversion inside production readers.

Old forms may exist only as literal input in explicitly named negative tests that assert rejection, or in immutable Codument archive history. They must not appear in positive tests, snapshots, current docs, examples, source composers, generated declarations/JavaScript, or package tarballs as accepted behavior.

## Diagnostics And Admission

The migration is deliberately breaking. Admission must produce stable, target-specific diagnostics for at least:

- old marker-name-plus-`Conf` transport;
- missing or multiple named ORM profiles;
- profile/target-kind mismatch;
- nested Field `storage` envelope;
- relation keys or topology inside a Field profile;
- relation profile on an untyped/scalar member;
- datasource annotation identity duplication;
- direct datasource `Conf` and missing datasource ORM profile;
- source-first/code-first metadata shape mismatch.

No diagnostic path may normalize an invalid old form into a valid model and continue.

## Project Boundaries

### Kunun language

Owns `KnKnot.NamedConf`, prefix-annotation attachment and metadata retention, its existing public datasource/entity/field annotation profiles, code-first type-system construction, and Kunun `1.0.4` package output. It preserves `:relation` NamedConf on a typed Property as generic annotation metadata but does not expose a public ORM relation descriptor/profile or own depa ORM relation vocabulary/runtime schemas.

### depa ORM

Owns ORM profile vocabulary, strict projection from the Kunun model, the bounded raw-declaration extraction described above, Field/Property/DataSource diagnostics, datasource fallback removal, runtime schema derivation, programmatic metadata adapters, package versioning, and absence of compatibility readers in source/dist/pack output.

### spl-bun

Owns the active test capsule, positive and negative fixtures, copied DSL documentation, domain-context bundles, web IDE/workbench/server consumers, dependency alignment, and residue guards. It consumes rather than redefines the Kunun and depa ORM contracts.

Mission planning, cross-project observation, and final convergence verification are direct mission actions. Source, tests, docs, generated artifacts, and package metadata are changed only by real tracks in their owning projects.

## Migration And Release Sequence

1. Freeze the exact contract and classify all old-syntax occurrences by live positive use, explicit negative test, generated output, current docs, or immutable archive.
2. Land Kunun NamedConf transport, existing datasource/entity/field profile parsing, generic typed-Property metadata preservation, and code-first equivalence in the already-unreleased `1.0.4` set. Do not reintroduce the retired public ORM relation profile.
3. Land depa ORM strict projection, flat Field metadata, datasource single authority, and compatibility removal. Affected public packages on `0.1.x` move to the next breaking `0.2.0` line unless dependency-graph evidence requires a broader coordinated package set.
4. Migrate spl-bun fixtures, docs, domain bundles, web IDE/workbench/server examples, tests, and dependency declarations.
5. Run test, typecheck, build, declaration/source inspection, pack, tarball inspection, and registry-targeted publish dry run in dependency order.
6. Do not execute an actual publish. Publication remains a separate explicit user action.

Published package preparation must retain intended `src` content while proving that neither `src`, `dist`, declaration files, nor tarball metadata exposes an accepted legacy path.

## Residue Gates

Each project must maintain a machine-enforced inventory that distinguishes allowed historical/negative literals from forbidden live authorities. The gate scans at least:

- source and programmatic composers;
- positive fixtures, snapshots, and application bundles;
- current docs and examples;
- generated JavaScript and declarations;
- package export surfaces and packed tarballs;
- parser/projector fallback branches and legacy diagnostics that still imply acceptance.

A text search alone is insufficient: direct behavior tests must prove rejection, and canonical inputs must be traced through the live compiler/runtime path.

## Controlled Replanning

Replanning requires code/test/package evidence or an explicit human decision, plus a revision increment and report. Expected triggers include:

- Kunun `NamedConf` cannot preserve attached metadata through both source and code-first paths.
- A currently shipped consumer depends on a legacy form not represented in the inventory.
- Removing direct datasource `Conf` exposes a separate non-ORM datasource concept that needs an explicit boundary.
- depa ORM package dependencies require a larger coordinated breaking-version set.
- packed artifacts differ from workspace source behavior.
- fresh verification finds a shadow model, permissive reader, or relation metadata on a Field.

Compatibility is not an automatic replanning outcome. Any proposal to retain it changes a confirmed P0 decision and requires explicit human approval.

## Risks And Controls

| Risk | Control |
| --- | --- |
| Mechanical syntax rewrite leaves old parser authority alive | Behavioral rejection tests plus source/dist/tarball residue gates |
| NamedConf becomes a shadow schema | Structural equivalence around the Kunun public type-system model |
| Flat Field metadata accidentally absorbs relation mapping | Strict key allowlist and Field/Property target-kind tests |
| Datasource identity remains duplicated | `#name`-only identity and rejection of annotation `key`/`name` |
| Composite joins regress during migration | Ordered tuple and through-topology positive/negative matrix |
| Positive fixtures hide compatibility | Explicit fixture classification and canonical-only positive corpus |
| Workspace passes but published artifacts drift | Build, declaration, pack, tarball, and publish-dry-run inspection |
| Mission drifts into publication | Hard non-goal and command-level evidence that only dry runs occurred |
